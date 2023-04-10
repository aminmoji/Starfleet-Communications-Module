// Dependencies
const express = require("express");
const app = express();
const methodOverRide = require("method-override");
const cors = require("cors");
// const cookieSession = require("cookie-session");
const sessions = require("express-session");
const userController = require("./controllers/user");
const sessionsController = require("./controllers/sessions");
const mongoose = require("mongoose");
require("dotenv").config();
const socket = require("socket.io");
const PORT = process.env.PORT;
const URL = process.env.DATABASE_URL;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(express.Router());
app.use("/user", userController);
app.use(
  sessions({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use("/sessions", sessionsController);

// Mongoose
mongoose.connect(process.env.DATABASE_URL);

const db = mongoose.connection;
db.on("error", (err) => console.log(err.message, +"no hailing frequency"));
db.on("connected", () => console.log("Mango On Screen"));
db.on("disconnected", () => console.log("End of Transmission"));

// Listener
app.listen(PORT, () => {
  console.log(`On Screen on port ${PORT}`);
});
