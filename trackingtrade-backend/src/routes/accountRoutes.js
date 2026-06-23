const router = require('express').Router();
const { getAccounts, createAccount, updateAccount, deleteAccount } = require('../controllers/accountController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/',      getAccounts);
router.post('/',     createAccount);
router.put('/:id',   updateAccount);
router.delete('/:id',deleteAccount);

module.exports = router;
