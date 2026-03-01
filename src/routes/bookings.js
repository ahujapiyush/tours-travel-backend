const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const bookingController = require('../controllers/bookingController');

router.use(authenticate);

router.post(
  '/',
  [
    body('car_id').isInt().withMessage('Car ID is required'),
    body('pickup_address').trim().notEmpty().withMessage('Pickup address is required'),
    body('pickup_lat').isFloat().withMessage('Pickup latitude is required'),
    body('pickup_lng').isFloat().withMessage('Pickup longitude is required'),
    body('drop_address').trim().notEmpty().withMessage('Drop address is required'),
    body('drop_lat').isFloat().withMessage('Drop latitude is required'),
    body('drop_lng').isFloat().withMessage('Drop longitude is required'),
    body('pickup_time').isISO8601().withMessage('Valid pickup time is required'),
  ],
  validate,
  bookingController.createBooking
);

router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);
router.put('/:id/status', authorize('admin'), bookingController.updateBookingStatus);
router.put('/:id/cancel', bookingController.cancelBooking);
router.post('/:id/rate', bookingController.rateBooking);

module.exports = router;
