const crypto = require("crypto");

function issueCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function tokensMatch(expected, received) {
  if (typeof expected !== "string" || typeof received !== "string") {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function verifyCsrfToken(req, res, next) {
  const received = req.body?._csrf || req.get("x-csrf-token");

  if (!tokensMatch(req.session?.csrfToken, received)) {
    return res.status(403).render("login", {
      message: "Your session expired. Refresh the page and try again.",
    });
  }

  return next();
}

module.exports = { issueCsrfToken, tokensMatch, verifyCsrfToken };
