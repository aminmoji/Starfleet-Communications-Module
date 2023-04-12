const express = require("express");
const app = express();
const methodOverRide = require("method-override");
const mongoose = require("mongoose");
const session = require("express-session");
const server = require("http").createServer(app);
const io = require("socket.io")(server);
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
const User = require("./models/user");
app.use("/sessions", sessionsController);

// Index
app.get("/", (req, res) => {
  if (req.session.currentUser) {
    res.render("dashboard.ejs", {
      currentUser: req.session.currentUser,
    });
  } else {
    res.render("index.ejs", {
      currentUser: req.session.currentUser,
    });
  }
});

// New Personal Chat
app.get("/new_chat", (req, res) => {
  res.render("new_chat.ejs", {
    currentUser: req.session.currentUser,
  });
});

// Search for contacts
app.post("/search", async (req, res) => {
  console.log(req.body.query);
  const query = req.body.query;
  if (req.body.query.length) {
    const users = await User.find({ lastname: query }).exec();
    console.log(users);
    res.render("search_results.ejs", {
      users,
      currentUser: req.session.currentUser,
    });
  } else {
    console.log("no content");
    res.redirect("/new_chat");
  }
});

io.on("connection", function (socket) {
  console.log("A user connected");
});

// Listener
server.listen(process.env.PORT, () => {
  console.log(`On Screen On Port ${process.env.PORT}`);
});
