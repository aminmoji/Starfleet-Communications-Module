const buckets = new Map();

function securityHeaders(req, res, next) {
  res.set({
    "Content-Security-Policy": [
      "default-src 'self'",
      "img-src 'self' https: data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self' ws: wss:",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  next();
}

function createRateLimiter({ windowMs, max }) {
  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const current = buckets.get(key);

    if (buckets.size > 10_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.set("Retry-After", String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).render("login", {
        message: "Too many attempts. Wait a few minutes and try again.",
      });
    }

    return next();
  };
}

module.exports = { createRateLimiter, securityHeaders };
