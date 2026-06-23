const router = require('express').Router();
const { getInsights, generateInsights, getScores, markRead } = require('../controllers/aiController');
const { protect, requirePlan } = require('../middleware/auth');

router.use(protect);
router.get('/insights',       getInsights);
router.post('/generate',      requirePlan('pro','elite'), generateInsights);
router.get('/scores',         getScores);
router.patch('/insights/:id/read', markRead);

module.exports = router;
