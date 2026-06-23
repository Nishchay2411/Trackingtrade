const jwt = require('jsonwebtoken');

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
    return res.status(401).json({
      success: false,
      message: 'Access denied. Please login first.'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Store user data in request
    req.user = decoded;

    next();
  } catch (error) {
    console.error('JWT Error:', error.message);

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

const requirePlan = (...plans) => {
  return (req, res, next) => {
    if (!req.user || !plans.includes(req.user.plan)) {
      return res.status(403).json({
        success: false,
        message: `This feature requires ${plans.join(' or ')} plan.`
      });
    }

    next();
  };
};

module.exports = {
  protect,
  requirePlan
};