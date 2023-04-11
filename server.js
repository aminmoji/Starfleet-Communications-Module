const express = require("express");
const app = express();
const methodOverRide = require("method-override");
const mongoose = require("mongoose");
const session = require("express-session");
require("dotenv").config();

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(methodOverRide("_method"));
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Database / Mongoose
mongoose.connect(process.env.DATABASE_URL);

db = mongoose.connection;
db.on("error", (err) => console.log(`${err.message} LCARS Down`));
db.on("connected", () => console.log("LCARS Connected"));
db.on("disconnected", () => console.log("LCARS Disconnected"));

// Routes / Controllers
const userController = require("./controllers/users");
app.use("/users", userController);

const sessionsController = require("./controllers/sessions");
app.use("/sessions", sessionsController);

// Index
app.get("/", (req, res) => {
  res.render("index.ejs", {
    currentUser: req.session.currentUser,
  });
});

// Listener
app.listen(process.env.PORT, () => {
  console.log(`On Screen On Port ${process.env.PORT}`);
});
