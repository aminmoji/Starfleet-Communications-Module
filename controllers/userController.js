const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const bcrypt = require("bcrypt");
const { BlobServiceClient } = require("@azure/storage-blob");
const streamifier = require("streamifier");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const registerLoad = async (req, res) => {
  try {
    res.render("register");
  } catch (error) {
    console.log(error.message);
  }
};

const register = async (req, res) => {
  try {
    const checkUserName = await User.findOne({ username: req.body.username });
    if (checkUserName) {
      return res.render("register", { message: "Username Already Exists." });
    } else {
      if (req.file) {
        console.log(process.env.AZURE_STORAGE_CONNECTION_STRING);
        const blobServiceClient = BlobServiceClient.fromConnectionString(
          process.env.AZURE_STORAGE_CONNECTION_STRING
        );
        const containerName = process.env.CONTAINER_NAME;
        const containerClient =
          blobServiceClient.getContainerClient(containerName);
        const blobName = req.file.originalname;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        const imageData = req.file.buffer;

        await blockBlobClient.upload(imageData, imageData.length);

        const imageUrl = blockBlobClient.url;
        // user.image = imageUrl;

        // const client = new MongoClient(process.env.MONGODB_CONNECTION_STRING);
        // await client.connect();
        // const database = client.db(process.env.MONGODB_DATABASE_NAME);
        // const collection = database.collection("users");
        // await collection.insertOne(user);
        // await client.close();

        const passwordHash = await bcrypt.hash(req.body.password, 10);
        const user = new User({
          username: req.body.username,
          firstname: req.body.firstname,
          lastname: req.body.lastname,
          password: passwordHash,
          ship: req.body.ship,
          species: req.body.species,
          rank: req.body.rank,
          image: imageUrl,
        });
        await user.save();
      }
      res.redirect("/login");
    }
  } catch (error) {
    console.log("Registration Error: " + error.message);
  }
};

const loadLogin = async (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    console.log(error.message);
  }
};

const login = async (req, res) => {
  try {
    const username = req.body.username;
    const password = req.body.password;

    const userData = await User.findOne({ username: username });
    if (userData) {
      const passwordMatch = await bcrypt.compare(password, userData.password);
      if (passwordMatch) {
        req.session.user = userData;
        res.redirect("/dashboard");
      } else {
        res.render("login", {
          message: "Username and Password are Incorrect!",
        });
      }
    } else {
      res.render("login", { message: "Username and Password are Incorrect!" });
    }
  } catch (error) {
    console.log(error.message);
  }
};

const logout = async (req, res) => {
  try {
    req.session.destroy();
    res.redirect("/");
  } catch (error) {
    console.log(error.message);
  }
};

const loadProfile = async (req, res) => {
  const editUser = await User.findById(req.session.user._id).exec();
  res.render("profile", {
    user: editUser,
  });
};

const editProfile = async (req, res) => {
  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const update = {
    username: req.body.username,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    password: passwordHash,
    rank: req.body.rank,
    ship: req.body.ship,
    species: req.body.species,
  };

  if (req.file) {
    const blobName = getBlobName(req.file.originalname);
    const containerName = process.env.CONTAINER_NAME;
    const blobService = new BlobServiceClient(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobService.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
    });

    update.image = blobName;
  }

  await User.findByIdAndUpdate(req.session.user._id, update);
  console.log(update);
  res.redirect("/dashboard");
};

const deleteProfile = async (req, res) => {
  await User.findByIdAndDelete(req.session.user._id);
  console.log("deleted");
  res.redirect("/login");
};

const loadDashboard = async (req, res) => {
  try {
    let users = await User.find({ _id: { $nin: [req.session.user._id] } });
    res.render("dashboard", {
      user: req.session.user,
      users: users,
    });
  } catch (error) {
    console.log(error.message);
  }
};

const saveChat = async (req, res) => {
  try {
    const chat = new Chat({
      sender_id: req.body.sender_id,
      receiver_id: req.body.receiver_id,
      message: req.body.message,
    });
    var newChat = await chat.save();
    res
      .status(200)
      .send({ success: true, msg: "Chat inserted!", data: newChat });
  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }
};

const lookUpCrew = async (req, res) => {
  try {
    const query = req.body.query;
    if (req.body.query.length) {
      const users = await User.find({
        _id: { $nin: req.session.user._id },
        $or: [
          {
            lastname: {
              $regex: query,
              $options: "i",
            },
          },
          {
            firstname: {
              $regex: query,
              $options: "i",
            },
          },
          {
            rank: {
              $regex: query,
              $options: "i",
            },
          },
          {
            ship: {
              $regex: query,
              $options: "i",
            },
          },
          {
            species: {
              $regex: query,
              $options: "i",
            },
          },
        ],
      });
      res.render("dashboardQuery", {
        users: users,
        user: req.session.user,
      });
    }
  } catch (error) {
    console.log(error.message);
  }
};

module.exports = {
  register,
  registerLoad,
  loadDashboard,
  login,
  loadLogin,
  logout,
  saveChat,
  lookUpCrew,
  loadProfile,
  editProfile,
  deleteProfile,
};
