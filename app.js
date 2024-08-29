const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const session = require("express-session");
const moment = require("moment");
const passport = require("passport");
const flash = require("connect-flash");
const mongoose = require("mongoose");

const Record = require("./models/record.model");
const User = require("./models/user.model");
const initializePassport = require("./passport-config");
const isAuthenticated = require("./middleware/auth");

// Initialize Express
const app = express();
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/excel_file_upload";
// MongoDB Connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Initialize Passport
initializePassport(passport);

// Middleware Setup
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: 'secret', // Replace with a strong secret in production
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Static Files
app.use(express.static(path.join(__dirname, "/static")));

// Templating Engine Setup
app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/content"));

// File Upload Configuration
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});

function checkFileType(file, cb) {
  const filetypes = /csv/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: CSV Files Only!');
  }
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 }, // limit file size to 1MB
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  }
}).single('csvfile');

// Set Global Variables for Views
app.use((req, res, next) => {
  res.locals.user = req.isAuthenticated() ? req.user : null;
  res.locals.isAuthenticated = req.isAuthenticated();
  res.locals.appName = 'My Awesome App';
  next();
});

// Routes
app.get("/", isAuthenticated, (req, res) => {
  getMonthlyStatistics().then(results => {
    res.render("index", {
      stats: results,
      layout: path.join(__dirname, "/layouts/dashboard"),
      footer: true,
    });
  });
});

app.get("/authentication/sign-in", (req, res) => {
  res.render("authentication/sign-in", {
    layout: path.join(__dirname, "/layouts/main"),
    navigation: false,
    footer: false,
  });
});

app.post('/authentication/sign-in', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/authentication/sign-in',
  failureFlash: true,
}));

app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/authentication/sign-in');
  });
});

app.post('/add-user', async (req, res) => {
  const { username, password, firstname, lastname } = req.body;

  try {
    const user = new User({ username, password, full_name: `${firstname} ${lastname}` });
    await user.save();
    res.redirect("back");
  } catch (err) {
    res.status(500).send('Error creating user: ' + err.message);
  }
});

app.get("/crud/products", isAuthenticated, async (req, res) => {
  const products = await findUniqueFilenamesAndCounts();
  res.render("crud/products", {
    layout: path.join(__dirname, "/layouts/dashboard"),
    footer: false,
    products,
  });
});

app.post('/crud/products', (req, res) => {
  upload(req, res, (err) => {
    if (err || !req.file) {
      return res.redirect("back");
    }

    const filePath = `./uploads/${req.file.filename}`;
    const records = [];
    const [month, day, year] = req.file.originalname.split("-")[0].split("_");
    const postDate = new Date(`${year}-${month}-${day}`);

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const seenTime = parseDate(row.Time, postDate);
        records.push({
          filename: req.file.originalname,
          name: row.Name,
          post_date: postDate,
          seen_time: seenTime,
        });
      })
      .on('end', async () => {
        try {
          await Record.insertMany(records);
          console.log('CSV file successfully processed and records inserted into the database');
          fs.unlinkSync(filePath);
          res.redirect("back");
        } catch (err) {
          console.error('Error inserting records:', err);
          res.redirect("back");
        }
      });
  });
});

app.get('/crud/users', isAuthenticated, async (req, res) => {
  const users = await User.find({});
  res.render("crud/users", {
    layout: path.join(__dirname, "/layouts/dashboard"),
    footer: false,
    users,
  });
});

app.get('/user-delete/:id', isAuthenticated, async (req, res) => {
  try {
    const userId = req.params.id;
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).redirect("back");
    }

    res.redirect("back");
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).redirect("back");
  }
});

app.get('/api/record-counts/:days/:userName?', async (req, res) => {
  const days = parseInt(req.params.days, 10);
  const userName = req.params.userName || null;
  const data = await getRecordCounts(days, userName);
  res.json(data);
});

// Utility Functions
async function getMonthlyStatistics() {
  const currentMonthStart = moment().startOf('month').toDate();
  const lastMonthStart = moment().subtract(1, 'month').startOf('month').toDate();
  const lastMonthEnd = moment().subtract(1, 'month').endOf('month').toDate();

  const currentMonthPosts = await Record.aggregate([
    { $match: { post_date: { $gte: currentMonthStart } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$post_date" } } } },
    { $count: "totalPosts" }
  ]);

  const lastMonthPosts = await Record.aggregate([
    { $match: { post_date: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$post_date" } } } },
    { $count: "totalPosts" }
  ]);

  const currentMonthViewers = await Record.aggregate([
    { $match: { seen_time: { $gte: currentMonthStart } } },
    { $group: { _id: "$name" } },
    { $count: "totalViewers" }
  ]);

  const lastMonthViewers = await Record.aggregate([
    { $match: { seen_time: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
    { $group: { _id: "$name" } },
    { $count: "totalViewers" }
  ]);

  const currentMonthRecords = await Record.countDocuments({ seen_time: { $gte: currentMonthStart } });
  const lastMonthRecords = await Record.countDocuments({ seen_time: { $gte: lastMonthStart, $lte: lastMonthEnd } });

  const postPercentageChange = calculatePercentageChange(currentMonthPosts[0]?.totalPosts || 0, lastMonthPosts[0]?.totalPosts || 0);
  const viewerPercentageChange = calculatePercentageChange(currentMonthViewers[0]?.totalViewers || 0, lastMonthViewers[0]?.totalViewers || 0);
  const recordPercentageChange = calculatePercentageChange(currentMonthRecords, lastMonthRecords);

  return {
    totalPosts: currentMonthPosts[0]?.totalPosts || 0,
    postPercentageChange,
    totalViewers: currentMonthViewers[0]?.totalViewers || 0,
    viewerPercentageChange,
    totalRecords: currentMonthRecords,
    recordPercentageChange,
  };
}

function calculatePercentageChange(current, previous) {
  if (previous > 0) {
    return (((current - previous) / previous) * 100).toFixed(2);
  } else {
    return current > 0 ? 100 : 0;
  }
}

async function findUniqueFilenamesAndCounts() {
  try {
    return await Record.aggregate([
      { $group: { _id: "$filename", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
  } catch (err) {
    console.error('Error finding unique filenames and counts:', err);
    throw err;
  }
}

function parseDate(dateString, postDate) {
  if (dateString.includes('Today')) {
    return moment(postDate).startOf('day').add(moment.duration(dateString.split('at')[1].trim())).toDate();
  } else if (dateString.includes('Yesterday')) {
    return moment(postDate).subtract(1, 'day').startOf('day').add(moment.duration(dateString.split('at')[1].trim())).toDate();
  } else {
    return moment(dateString, ['YYYY/MM/DD', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY']).toDate();
  }
}

async function getRecordCounts(days, userName = null) {
  const startDate = moment().subtract(days, 'days').startOf('day');
  const endDate = moment().endOf('day');

  const matchCriteria = { post_date: { $gte: startDate.toDate() } };
  if (userName) matchCriteria.name = userName;

  const recordCounts = await Record.aggregate([
    { $match: matchCriteria },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$post_date" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const dateMap = new Map();
  for (let m = startDate.clone(); m.isBefore(endDate); m.add(1, 'days')) {
    dateMap.set(m.format('YYYY-MM-DD'), 0);
  }

  recordCounts.forEach(record => {
    dateMap.set(record._id, record.count);
  });

  return Array.from(dateMap, ([date, count]) => ({ date, count }));
}

// Start Server
app.listen(3001, () => {
  console.log("Server running on port 3001");
});
