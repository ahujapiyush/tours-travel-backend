const router = require('express').Router();
const multer = require('multer');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const carController = require('../controllers/carController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// Public routes
router.get('/categories', carController.getCategories);
router.get('/', carController.getCars);
router.get('/:id', carController.getCarById);

// Admin routes
router.post('/upload-image', authenticate, authorize('admin'), upload.single('image'), carController.uploadCarImage);
router.post('/:id/images', authenticate, authorize('admin'), upload.single('image'), carController.addCarImage);

router.post(
  '/',
  authenticate,
  authorize('admin'),
  [
    body('name').trim().notEmpty().withMessage('Car name is required'),
    body('brand').trim().notEmpty().withMessage('Brand is required'),
    body('model').trim().notEmpty().withMessage('Model is required'),
    body('year').isInt({ min: 2000, max: 2030 }).withMessage('Valid year is required'),
    body('color').trim().notEmpty().withMessage('Color is required'),
    body('registration_number').trim().notEmpty().withMessage('Registration number is required'),
    body('seats').isInt({ min: 1, max: 50 }).withMessage('Seats must be between 1-50'),
    body('price_per_km').isFloat({ min: 0 }).withMessage('Price per km is required'),
    body('base_price').isFloat({ min: 0 }).withMessage('Base price is required'),
  ],
  validate,
  carController.createCar
);

router.put('/:id', authenticate, authorize('admin'), carController.updateCar);
router.delete('/:id', authenticate, authorize('admin'), carController.deleteCar);
router.put('/:id/location', authenticate, carController.updateCarLocation);

module.exports = router;
