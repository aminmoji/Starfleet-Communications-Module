const express = require("express");

const userController = require("../controllers/userController");
const auth = require("../middlewares/auth");
const { verifyCsrfToken } = require("../middlewares/csrf");
const { createRateLimiter } = require("../middlewares/security");
const { upload } = require("../middlewares/upload");

const router = express.Router();
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

router.get("/", auth.isLoggedOut, userController.loadLogin);
router.get("/login", auth.isLoggedOut, userController.loadLogin);
router.post("/login", auth.isLoggedOut, authLimiter, verifyCsrfToken, userController.login);

router.get("/register", auth.isLoggedOut, userController.registerLoad);
router.post(
  "/register",
  auth.isLoggedOut,
  authLimiter,
  upload.single("image"),
  verifyCsrfToken,
  userController.register
);

router.post("/logout", auth.isLoggedIn, verifyCsrfToken, userController.logout);
router.get("/avatars/:userId", auth.isLoggedIn, userController.loadAvatar);
router.get("/dashboard", auth.isLoggedIn, userController.loadDashboard);
router.get("/profile", auth.isLoggedIn, userController.loadProfile);
router.post(
  "/profile",
  auth.isLoggedIn,
  upload.single("image"),
  verifyCsrfToken,
  userController.editProfile
);
router.post("/profile/delete", auth.isLoggedIn, verifyCsrfToken, userController.deleteProfile);

module.exports = router;
