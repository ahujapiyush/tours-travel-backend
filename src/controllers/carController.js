const db = require('../config/database');
const ALLOWED_CAR_STATUSES = ['available', 'booked', 'maintenance', 'inactive'];

let carImagesTableEnsured = false;

const ensureCarImagesTable = async () => {
  if (carImagesTableEnsured) return;
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
  carImagesTableEnsured = true;
};

const buildImageUrl = (req, carId, imageId) => {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim() || 'https';
  return `${proto}://${req.get('host')}/assets/car/${carId}/${imageId}`;
};

const enrichCarsWithUploadedImages = async (req, cars) => {
  if (!cars?.length) return;
  await ensureCarImagesTable();
  const ids = cars.map((car) => car.id);
  const imageRows = await db('car_images').select('id', 'car_id').whereIn('car_id', ids).orderBy('id', 'asc');
  const imageMap = imageRows.reduce((acc, row) => {
    acc[row.car_id] = acc[row.car_id] || [];
    acc[row.car_id].push(buildImageUrl(req, row.car_id, row.id));
    return acc;
  }, {});

  cars.forEach((car) => {
    const existing = Array.isArray(car.images) ? car.images : [];
    const uploaded = imageMap[car.id] || [];
    car.images = [...uploaded, ...existing
      .filter((url) => typeof url === 'string' && !uploaded.includes(url))
      .map((url) => url.replace(/^http:\/\//i, 'https://'))];
    if (!car.image_url && car.images[0]) {
      car.image_url = car.images[0];
    } else if (car.image_url) {
      car.image_url = car.image_url.replace(/^http:\/\//i, 'https://');
    }
  });
};

// POST /api/cars/upload-image (Admin)
exports.uploadCarImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const mimeType = req.file.mimetype || 'image/jpeg';
    const imageDataUrl = `data:${mimeType};base64,${req.file.buffer.toString('base64')}`;
    res.status(201).json({ image_data_url: imageDataUrl });
  } catch (error) {
    next(error);
  }
};

// POST /api/cars/:id/images (Admin)
exports.addCarImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const carId = parseInt(req.params.id, 10);
    if (!carId) {
      return res.status(400).json({ error: 'Valid car id is required' });
    }

    const car = await db('cars').where({ id: carId }).first();
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    await ensureCarImagesTable();
    const [row] = await db('car_images')
      .insert({
        car_id: carId,
        image_data: req.file.buffer,
        mime_type: req.file.mimetype || 'image/jpeg',
      })
      .returning(['id', 'car_id']);

    const imageUrl = buildImageUrl(req, row.car_id, row.id);

    const existingImages = (() => {
      try {
        return JSON.parse(car.images || '[]');
      } catch {
        return [];
      }
    })();

    const updatedImages = [imageUrl, ...existingImages.filter((url) => typeof url === 'string' && url !== imageUrl)];
    await db('cars').where({ id: carId }).update({
      images: JSON.stringify(updatedImages),
      image_url: car.image_url || imageUrl,
      updated_at: db.fn.now(),
    });

    res.status(201).json({ image_url: imageUrl, image_id: row.id });
  } catch (error) {
    next(error);
  }
};

// GET /api/cars?city_id=&state_id=&category_id=&status=&page=&limit=
exports.getCars = async (req, res, next) => {
  try {
    const { city_id, state_id, category_id, status, fuel_type, transmission, min_seats, max_price, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('cars')
      .select(
        'cars.*',
        'car_categories.name as category_name',
        'cities.name as city_name',
        'states.name as state_name'
      )
      .leftJoin('car_categories', 'cars.category_id', 'car_categories.id')
      .leftJoin('cities', 'cars.city_id', 'cities.id')
      .leftJoin('states', 'cars.state_id', 'states.id')
      .where('cars.is_active', true);

    if (city_id) query = query.where('cars.city_id', city_id);
    if (state_id) query = query.where('cars.state_id', state_id);
    if (category_id) query = query.where('cars.category_id', category_id);
    if (status) query = query.where('cars.status', status);
    if (fuel_type) query = query.where('cars.fuel_type', fuel_type);
    if (transmission) query = query.where('cars.transmission', transmission);
    if (min_seats) query = query.where('cars.seats', '>=', min_seats);
    if (max_price) query = query.where('cars.price_per_km', '<=', max_price);
    if (search) {
      query = query.where(function () {
        this.where('cars.name', 'ilike', `%${search}%`)
          .orWhere('cars.brand', 'ilike', `%${search}%`)
          .orWhere('cars.model', 'ilike', `%${search}%`);
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count('cars.id as total').first();
    const [{ total }] = await Promise.all([countQuery]);

    const cars = await query.orderBy('cars.rating', 'desc').limit(limit).offset(offset);

    // Parse JSON fields
    cars.forEach((car) => {
      try { car.features = JSON.parse(car.features); } catch { car.features = []; }
      try { car.images = JSON.parse(car.images); } catch { car.images = []; }
    });

    await enrichCarsWithUploadedImages(req, cars);

    res.json({
      cars,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/cars/:id
exports.getCarById = async (req, res, next) => {
  try {
    const car = await db('cars')
      .select(
        'cars.*',
        'car_categories.name as category_name',
        'cities.name as city_name',
        'states.name as state_name'
      )
      .leftJoin('car_categories', 'cars.category_id', 'car_categories.id')
      .leftJoin('cities', 'cars.city_id', 'cities.id')
      .leftJoin('states', 'cars.state_id', 'states.id')
      .where('cars.id', req.params.id)
      .first();

    if (!car) return res.status(404).json({ error: 'Car not found' });

    try { car.features = JSON.parse(car.features); } catch { car.features = []; }
    try { car.images = JSON.parse(car.images); } catch { car.images = []; }

    await enrichCarsWithUploadedImages(req, [car]);

    // Get reviews for this car
    const reviews = await db('reviews')
      .select('reviews.*', 'users.name as customer_name')
      .leftJoin('users', 'reviews.customer_id', 'users.id')
      .where('reviews.car_id', car.id)
      .orderBy('reviews.created_at', 'desc')
      .limit(10);

    res.json({ car, reviews });
  } catch (error) {
    next(error);
  }
};

// POST /api/cars (Admin)
exports.createCar = async (req, res, next) => {
  try {
    const {
      name, brand, model, year, color, registration_number, seats,
      fuel_type, transmission, mileage, ac, features, image_url, images,
      category_id, city_id, state_id, price_per_km, price_per_hour, base_price,
    } = req.body;

    const existing = await db('cars').where({ registration_number }).first();
    if (existing) {
      return res.status(409).json({ error: 'Car with this registration number already exists' });
    }

    if (req.body.status && !ALLOWED_CAR_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_CAR_STATUSES.join(', ')}` });
    }

    const [car] = await db('cars')
      .insert({
        name, brand, model, year, color, registration_number, seats,
        fuel_type, transmission, mileage, ac,
        features: features ? JSON.stringify(features) : null,
        image_url,
        images: images ? JSON.stringify(images) : null,
        category_id, city_id, state_id, price_per_km, price_per_hour, base_price,
      })
      .returning('*');

    res.status(201).json({ car });
  } catch (error) {
    next(error);
  }
};

// PUT /api/cars/:id (Admin)
exports.updateCar = async (req, res, next) => {
  try {
    const updates = { ...req.body, updated_at: db.fn.now() };
    if (updates.status && !ALLOWED_CAR_STATUSES.includes(updates.status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_CAR_STATUSES.join(', ')}` });
    }
    if (updates.features) updates.features = JSON.stringify(updates.features);
    if (updates.images) {
      const cleanedImages = Array.isArray(updates.images)
        ? updates.images.filter((url) => typeof url === 'string' && !url.startsWith('data:image/'))
        : [];
      updates.images = JSON.stringify(cleanedImages.map((url) => url.replace(/^http:\/\//i, 'https://')));
    }
    if (updates.image_url && typeof updates.image_url === 'string') {
      updates.image_url = updates.image_url.replace(/^http:\/\//i, 'https://');
    }

    ['year', 'seats', 'state_id', 'city_id', 'category_id'].forEach((field) => {
      if (updates[field] !== undefined && updates[field] !== null) {
        const parsed = parseInt(updates[field], 10);
        updates[field] = Number.isFinite(parsed) ? parsed : null;
      }
    });
    ['price_per_km', 'base_price', 'price_per_hour', 'mileage'].forEach((field) => {
      if (updates[field] !== undefined && updates[field] !== null && updates[field] !== '') {
        const parsed = parseFloat(updates[field]);
        updates[field] = Number.isFinite(parsed) ? parsed : null;
      }
    });

    const [car] = await db('cars')
      .where({ id: req.params.id })
      .update(updates)
      .returning('*');

    if (!car) return res.status(404).json({ error: 'Car not found' });

    res.json({ car });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/cars/:id (Admin - soft delete)
exports.deleteCar = async (req, res, next) => {
  try {
    const [car] = await db('cars')
      .where({ id: req.params.id })
      .update({ is_active: false, updated_at: db.fn.now() })
      .returning('id');

    if (!car) return res.status(404).json({ error: 'Car not found' });

    res.json({ message: 'Car deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/cars/:id/location (Update car GPS location)
exports.updateCarLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    await db('cars')
      .where({ id: req.params.id })
      .update({ current_lat: latitude, current_lng: longitude, updated_at: db.fn.now() });

    res.json({ message: 'Location updated' });
  } catch (error) {
    next(error);
  }
};

// GET /api/cars/categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await db('car_categories').where({ is_active: true }).orderBy('name');
    res.json({ categories });
  } catch (error) {
    next(error);
  }
};
