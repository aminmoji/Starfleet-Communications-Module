const express = require("express");
const { upload } = require("../middlewares/upload");

const user_route = express();

const bodyParser = require("body-parser");

const session = require("express-session");
user_route.use(session({ secret: process.env.SESSION_SECRET }));

user_route.use(bodyParser.json());
user_route.use(bodyParser.urlencoded({ extended: true }));

user_route.set("view engine", "ejs");
user_route.set("views", "./views");

user_route.use(express.static("public"));

const userController = require("../controllers/userController");

const auth = require("../middlewares/auth");

user_route.get("/register", auth.isLoggedout, userController.registerLoad);
user_route.post("/register", upload.single("image"), userController.register);

user_route.get("/", auth.isLoggedout, userController.loadLogin);
user_route.post("/", userController.login);
user_route.get("/logout", auth.isLoggedin, userController.logout);
user_route.post("/lookUp", userController.lookUpCrew);

user_route.get("/profile", auth.isLoggedin, userController.loadProfile);
user_route.post("/update", auth.isLoggedin, userController.editProfile);

user_route.post("/delete", auth.isLoggedin, userController.deleteProfile);

user_route.get("/dashboard", auth.isLoggedin, userController.loadDashboard);
user_route.post("/save-chat", userController.saveChat);

user_route.get("*", function (req, res) {
  res.redirect("/");
});

module.exports = user_route;
