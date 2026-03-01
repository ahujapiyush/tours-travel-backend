const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const locationController = require('../controllers/locationController');

// Public routes
router.get('/states', locationController.getStates);
router.get('/cities', locationController.getCities);

// Google Maps proxy (authenticated)
router.get('/places/autocomplete', authenticate, locationController.placesAutocomplete);
router.get('/places/details', authenticate, locationController.placeDetails);
router.get('/distance', authenticate, locationController.calculateDistance);

// Admin routes
router.post('/states', authenticate, authorize('admin'), locationController.createState);
router.post('/cities', authenticate, authorize('admin'), locationController.createCity);
router.put('/states/:id', authenticate, authorize('admin'), locationController.updateState);
router.put('/cities/:id', authenticate, authorize('admin'), locationController.updateCity);

module.exports = router;
