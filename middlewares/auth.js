const isLoggedin = async (req, res, next) => {
  try {
    if (req.session.user) {
      next();
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.log(error.message);
  }
};

const isLoggedout = async (req, res, next) => {
  try {
    if (req.session.user) {
      res.redirect("/dashboard");
    } else {
      next();
    }
  } catch (error) {
    console.log(error.message);
  }
};

module.exports = {
  isLoggedout,
  isLoggedin,
};
