const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const customerController = require('../controllers/customerController');

router.get('/coupons/validate', authenticate, customerController.validateCoupon);
router.get('/favorites', authenticate, customerController.getFavorites);
router.post('/favorites', authenticate, customerController.addFavorite);
router.delete('/favorites/:car_id', authenticate, customerController.removeFavorite);

module.exports = router;
