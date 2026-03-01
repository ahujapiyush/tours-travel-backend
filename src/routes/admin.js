const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));

router.get('/dashboard', adminController.getDashboard);
router.get('/customers', adminController.getCustomers);
router.post('/customers', adminController.createCustomer);
router.post('/bookings', adminController.createBookingForCustomer);
router.get('/reports', adminController.getReports);
router.get('/drivers', adminController.getDrivers);
router.post('/drivers', adminController.createDriver);
router.put('/drivers/:id/assign-car', adminController.assignCarToDriver);

module.exports = router;
