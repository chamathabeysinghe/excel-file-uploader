const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");
const multer = require('multer');

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

// Static Files
app.use(express.static(path.join(__dirname, "/static")));

// Set Templating Engine
app
  .use(expressLayouts)
  .set("view engine", "ejs")
  .set("views", path.join(__dirname, "/content"));

app.get("/", (req, res) => {
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

// Handle file upload
app.post('/crud/products', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.log('error..........')
      console.log('error..........')
      console.log('error..........')
      console.log('error..........')
      console.log('error..........')
      console.log(err)
      return res.redirect("back")
    } else {
      if (req.file == undefined) {
        console.log('error..........')
        console.log('error..........')
        console.log('error..........')
        console.log('error..........')
        console.log('error..........')
        return res.redirect("back")
      } else {
        console.log(req.file.filename)
        console.log(req.file.filename)
        console.log(req.file.filename)
        console.log(req.file.filename)
        console.log(req.file.filename)
        // res.send(`<h1>File Uploaded: ${req.file.filename}</h1>`);
        return res.redirect("back")

      }
    }
  });
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
