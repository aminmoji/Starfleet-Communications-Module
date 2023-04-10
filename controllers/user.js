const express = require("express");
const bcrypt = require("bcrypt");
const userRouter = express.Router();
const User = require("../models/user");

// Index/User
userRouter.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

// Create
userRouter.post("/", (req, res) => {
  console.log(req.body);
  req.body.password = bcrypt.hashSync(
    req.body.password,
    bcrypt.genSaltSync(10)
  );
  const createdUser = new User(req.body);
  createdUser.save().then(res.send("User Created"));
});

module.exports = userRouter;
