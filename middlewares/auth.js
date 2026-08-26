function isLoggedIn(req, res, next) {
  if (req.session?.userId) {
    return next();
  }

  return res.redirect("/login");
}

function isLoggedOut(req, res, next) {
  if (req.session?.userId) {
    return res.redirect("/dashboard");
  }

  return next();
}

module.exports = { isLoggedIn, isLoggedOut };
