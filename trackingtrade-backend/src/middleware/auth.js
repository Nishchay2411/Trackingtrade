const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const protect = (req, res, next) => {
  let token;

  // Get token from Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // No token provided
  if (!token) {
    return res.fail('Access denied. Please login first.', 401);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Store user data in request
    req.user = decoded;

    next();
  } catch (error) {
    logger.warn('JWT verification failed:', error.message);
    return res.fail('Invalid or expired token.', 401);
  }
};

const requirePlan = (...plans) => {
  return (req, res, next) => {
    if (!req.user || !plans.includes(req.user.plan)) {
      return res.fail(`This feature requires ${plans.join(' or ')} plan.`, 403);
    }

    next();
  };
};

module.exports = {
  protect,
  requirePlan
};
