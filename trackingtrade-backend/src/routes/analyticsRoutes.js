const router = require('express').Router();
const { getOverview, getMonthlyPnL, getByPair, getByStrategy, getBySession, getCalendar, getEquityCurve } = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/overview',      getOverview);
router.get('/monthly',       getMonthlyPnL);
router.get('/by-pair',       getByPair);
router.get('/by-strategy',   getByStrategy);
router.get('/by-session',    getBySession);
router.get('/calendar',      getCalendar);
router.get('/equity-curve',  getEquityCurve);

module.exports = router;
