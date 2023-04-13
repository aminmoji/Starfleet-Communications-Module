// Dependencies
const bcrypt = require("bcrypt");
const express = require("express");
const userRouter = express.Router();
const User = require("../models/user");

// New / Registration
userRouter.get("/new", (req, res) => {
  res.render("users/new.ejs", {
    currentUser: req.session.currentUser,
  });
});
// Create / Registration Route
userRouter.post("/", async (req, res) => {
  const user = new User({
    username: req.body.username,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    password: (req.body.password = bcrypt.hashSync(
      req.body.password,
      bcrypt.genSaltSync(10)
    )),
    rank: req.body.rank,
    ship: req.body.ship,
    species: req.body.species,
    profilepic: req.body.profilepic,
  });
  user.save().then(res.redirect("/"));
});

// Edit
userRouter.get("/:id/profile/", async (req, res) => {
  const currentUser = await User.findById(req.params.id).exec();
  res.render("users/profile.ejs", {
    currentUser,
  });
});

// Export User Route
module.exports = userRouter;
