require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./config/database');

const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const reviewScheduler = require('./services/reviewScheduler');

// Routes
const authRoutes = require('./routes/auth');
const carRoutes = require('./routes/cars');
const bookingRoutes = require('./routes/bookings');
const locationRoutes = require('./routes/locations');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const customerRoutes = require('./routes/customer');
const pollRoutes = require('./routes/poll');

const app = express();

// ── Middleware ──
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // generous limit for development
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', config.uploads.dir)));
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));

app.get('/assets/car/:carId/:imageId', async (req, res, next) => {
  try {
    const carId = parseInt(req.params.carId, 10);
    const imageId = parseInt(req.params.imageId, 10);
    if (!carId || !imageId) {
      return res.status(400).json({ error: 'Invalid asset path' });
    }

    await db.raw(`
      CREATE TABLE IF NOT EXISTS car_images (
        id SERIAL PRIMARY KEY,
        car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
        image_data BYTEA NOT NULL,
        mime_type VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    const image = await db('car_images')
      .select('image_data', 'mime_type')
      .where({ id: imageId, car_id: carId })
      .first();

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.setHeader('Content-Type', image.mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(image.image_data);
  } catch (error) {
    next(error);
  }
});

// ── API Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/poll', pollRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// ── Start Server (local only — Vercel exports app directly) ──
if (require.main === module) {
  app.listen(config.port, async () => {
    console.log(`
  ╔════════════════════════════════════════════╗
  ║   🚗 Tours & Travel API Server            ║
  ║   Running on port ${config.port}                    ║
  ║   Environment: ${config.nodeEnv}             ║
  ╚════════════════════════════════════════════╝
  `);
    try {
      await reviewScheduler.start();
    } catch (err) {
      console.error('Failed to start review scheduler:', err.message);
    }
  });
}

module.exports = app;
