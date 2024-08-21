const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");
const multer = require('multer');
const csv = require('csv-parser');
const Record = require('./models/record.model'); // Import the Record model
const User = require('./models/user.model'); // Import the Record model
const fs = require('fs');
const session = require('express-session');

const moment = require('moment'); // Import moment
const passport = require('passport');
const flash = require('connect-flash');
const initializePassport = require('./passport-config');
const isAuthenticated = require('./middleware/auth');



const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
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

// Initialize upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 1000000 }, // limit file size to 1MB
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  }
}).single('csvfile'); // 'csvfile' is the name attribute of the input field in the HTML form


const mongoose = require('mongoose');

// Replace the following with your MongoDB connection string
const mongoURI = 'mongodb://localhost:27017/excel_file_upload';

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

const app = express();
initializePassport(passport);

// Middleware
app.use(express.urlencoded({ extended: false })); // To parse form data
app.use(session({
  secret: 'secret', // Replace with a strong secret in production
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Static Files
app.use(express.static(path.join(__dirname, "/static")));

// Set Templating Engine
app
  .use(expressLayouts)
  .set("view engine", "ejs")
  .set("views", path.join(__dirname, "/content"));

app.get("/", isAuthenticated, (req, res) => {
  res.render("index", {
    layout: path.join(__dirname, "/layouts/dashboard"),
    footer: true,
  });
});

app.get("/settings", (req, res) => {
  res.render("settings", {
    layout: path.join(__dirname, "/layouts/dashboard"),
    footer: true,
  });
});

app.get("/authentication/forgot-password", (req, res) => {
  res.render("authentication/forgot-password", {
    layout: path.join(__dirname, "/layouts/main"),
    navigation: false,
    footer: false,
  });
});

app.get("/authentication/profile-lock", (req, res) => {
  res.render("authentication/profile-lock", {
    layout: path.join(__dirname, "/layouts/main"),
    navigation: false,
    footer: false,
  });
});

app.get("/authentication/sign-in", (req, res) => {
  res.render("authentication/sign-in", {
    layout: path.join(__dirname, "/layouts/main"),
    navigation: false,
    footer: false,
  });
});

// Route to handle login logic
app.post('/authentication/sign-in', passport.authenticate('local', {
  successRedirect: '/', // Redirect to dashboard or homepage on success
  failureRedirect: '/authentication/sign-in', // Redirect back to login page on failure
  failureFlash: true // Enable flash messages (requires connect-flash middleware)
}));

app.post('/add-user', async (req, res, next) => {
  const { username, password, firstname, lastname } = req.body;

  try {
    // Create a new user
    const user = new User({ username, password, full_name: firstname+" "+lastname });
    await user.save();
    return res.redirect("back")
    // Authenticate the user using passport's login method
    // req.login(user, (err) => {
    //   if (err) {
    //     return next(err);
    //   }
    //   // Redirect to the dashboard or another page after successful login
    //   return res.redirect('/dashboard');
    // });
  } catch (err) {
    res.status(500).send('Error creating user: ' + err.message);
  }
});

// Logout route
app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('/authentication/sign-in'); // Redirect to the login page after logout
  });
});

app.get("/authentication/sign-up", (req, res) => {
  res.render("authentication/sign-up", {
    layout: path.join(__dirname, "/layouts/main"),
    navigation: false,
    footer: false,
  });
});

app.get("/authentication/reset-password", (req, res) => {
  res.render("authentication/reset-password", {
    layout: path.join(__dirname, "/layouts/main"),
    navigation: false,
    footer: false,
  });
});

app.get("/crud/products", (req, res) => {
  const products = require("./data/products.json");
  res.render("crud/products", {
    layout: path.join(__dirname, "/layouts/dashboard"),
    footer: false,
    products,
  });
});

function parseDate(dateString, postDate) {
  if (dateString.includes('Today')) {
    return moment(postDate).startOf('day').add(moment.duration(dateString.split('at')[1].trim())).toDate();
  } else if (dateString.includes('Yesterday')) {
    return moment(postDate).subtract(1, 'day').startOf('day').add(moment.duration(dateString.split('at')[1].trim())).toDate();
  } else {
    return moment(dateString, ['YYYY/MM/DD', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY']).toDate();
  }
}


// Handle file upload
app.post('/crud/products', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      return res.redirect("back")
    } else {
      if (req.file == undefined) {
        return res.redirect("back")
      } else {
        const filePath = `./uploads/${req.file.filename}`;
        const records = [];
        var postDate = req.file.originalname.split("-")[0]
        var [month, day, year] = postDate.split("_");
        postDate = new Date(`${year}-${month}-${day}`);
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            // Push each record to the records array
            var seenTime = parseDate(row.Time, postDate)
            console.log(seenTime)
            records.push({
              name: row.Name,
              post_date: postDate, // Assuming "Time" column contains dates
              seen_time: seenTime // Assuming you want to set the seen_time to the current date/time
            });
          })
          .on('end', () => {
            // Insert records into the database
            Record.insertMany(records)
              .then(() => {
                console.log('CSV file successfully processed and records inserted into the database');
                return res.redirect("back")
              })
              .catch((err) => {
                console.error('Error inserting records:', err);
                return res.redirect("back")
              });

            // Optionally, delete the uploaded file after processing
            fs.unlinkSync(filePath);
          });
      }
    }
  });
});

// Function to get data for the last 7 or 30 days with optional userName filter
async function getRecordCounts(days, userName = null) {
  const startDate = moment().subtract(days, 'days').startOf('day');
  const endDate = moment().endOf('day');

  // Step 1: Build the match criteria
  const matchCriteria = {
    post_date: { $gte: startDate.toDate() }
  };

  if (userName) {
    matchCriteria.name = userName;
  }
  console.log(matchCriteria)

  // Step 2: Get the aggregated record counts from the database
  const recordCounts = await Record.aggregate([
    {
      $match: matchCriteria
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$post_date" }
        },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 } // Sort by date
    }
  ]);

  // Step 3: Generate a complete list of dates within the range
  const dateMap = new Map();

  for (let m = startDate.clone(); m.isBefore(endDate); m.add(1, 'days')) {
    dateMap.set(m.format('YYYY-MM-DD'), 0); // Initialize each date with 0
  }

  // Step 4: Fill in the dateMap with actual counts from the aggregation
  recordCounts.forEach(record => {
    dateMap.set(record._id, record.count);
  });

  // Step 5: Convert the dateMap back to an array
  const completeRecordCounts = Array.from(dateMap, ([date, count]) => ({
    date,
    count
  }));

  return completeRecordCounts;
}

// Modified endpoint to handle optional userName
app.get('/api/record-counts/:days/:userName?', async (req, res) => {
  const days = parseInt(req.params.days, 10);
  const userName = req.params.userName || null;
  console.log(userName)
  console.log(userName)
  console.log(userName)
  console.log(userName)
  const data = await getRecordCounts(days, userName);
  res.json(data);
});


app.get("/crud/users", (req, res) => {
  const users = require("./data/users.json");
  res.render("crud/users", {
    layout: path.join(__dirname, "/layouts/dashboard"),
    footer: false,
    users,
  });
});

app.get("/layouts/stacked", (req, res) => {
  res.render("layouts/stacked", {
    layout: path.join(__dirname, "/layouts/stacked-layout"),
    footer: true,
  });
});

app.get("/layouts/sidebar", (req, res) => {
  res.render("layouts/sidebar", {
    layout: path.join(__dirname, "/layouts/dashboard"),
    footer: true,
  });
});

app.get("/pages/404", (req, res) => {
  res.render("pages/404", {
    layout: path.join(__dirname, "/layouts/main"),
    navigation: false,
    footer: false,
  });
});

app.get("/pages/500", (req, res) => {
  res.render("pages/500", {
    layout: path.join(__dirname, "/layouts/main"),
    navigation: false,
    footer: false,
  });
});

app.get("/pages/maintenance", (req, res) => {
  res.render("pages/maintenance", {
    layout: path.join(__dirname, "/layouts/main"),
    navigation: false,
    footer: false,
  });
});

app.get("/pages/pricing", (req, res) => {
  res.render("pages/pricing", {
    layout: path.join(__dirname, "/layouts/main"),
    navigation: true,
    footer: false,
  });
});

app.get("/playground/sidebar", (req, res) => {
  res.render("playground/sidebar", {
    layout: path.join(__dirname, "/layouts/dashboard"),
    footer: true,
  });
});

app.get("/playground/stacked", (req, res) => {
  res.render("playground/stacked", {
    layout: path.join(__dirname, "/layouts/stacked-layout"),
    footer: true,
  });
});

app.listen(3001, () => {
  console.log("Server running on port 3001");
});
