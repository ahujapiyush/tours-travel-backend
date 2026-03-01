const db = require('../config/database');

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
    if (updates.features) updates.features = JSON.stringify(updates.features);
    if (updates.images) updates.images = JSON.stringify(updates.images);

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
