const router = require('express').Router();
const { getAllTrades, getTrade, createTrade, updateTrade, deleteTrade } = require('../controllers/tradeController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',      getAllTrades);
router.get('/:id',   getTrade);
router.post('/',     createTrade);
router.put('/:id',   updateTrade);
router.delete('/:id',deleteTrade);

module.exports = router;
