// Dependencies
const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const methodOverRide = require("method-override");
const sessions = require("express-session");
const mongoose = require("mongoose");
const socket = require("socket.io");
const PORT = process.env.PORT;
const URL = process.env.DATABASE_URL;

// Mongoose
mongoose.connect(URL);

const db = mongoose.connection;
db.on("error", (err) => console.log(err.message, +"no hailing frequency"));
db.on("connected", () => console.log("Mango On Screen"));
db.on("disconnected", () => console.log("End of Transmission"));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(methodOverRide("_method"));
app.use(
  sessions({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// Routes / Controllers
const userController = require("./controllers/users");
const sessionsController = require("./controllers/sessions");
app.use("", userController);
app.use("", sessionsController);

// Listener
app.listen(PORT, () => {
  console.log(`On Screen on port ${PORT}`);
});
