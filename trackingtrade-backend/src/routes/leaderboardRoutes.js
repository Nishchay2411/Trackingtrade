const router = require('express').Router();
const { getLeaderboard, updateMyStats } = require('../controllers/leaderboardController');
const { protect } = require('../middleware/auth');

router.get('/',           protect, getLeaderboard);
router.post('/update',    protect, updateMyStats);

module.exports = router;
