// Dependencis
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const userRouter = express.Router();
const User = require("../models/user");

mongoose.connect(process.env.DATABASE_URL);
const db = mongoose.connection;
db.on("error", (err) => console.log(err.message, +"no hailing frequency"));
db.on("connected", () => console.log("Mango On Screen"));
db.on("disconnected", () => console.log("End of Transmission"));

// Index/User
userRouter.get("/", async (req, res) => {
  const loggedUser = await User.find({ username: req.session.currentUser });
  res.render("index.ejs", {
    user: loggedUser,
  });
});

// New
userRouter.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

// Create
userRouter.post("/signup", (req, res) => {
  console.log(req.body);
  req.body.password = bcrypt.hashSync(
    req.body.password,
    bcrypt.genSaltSync(10)
  );
  const createdUser = new User(req.body);
  createdUser.save().then(res.send("User Created")).then(res.redirect("/"));
});

module.exports = userRouter;
