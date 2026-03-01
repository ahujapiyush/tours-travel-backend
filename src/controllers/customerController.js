const db = require('../config/database');

// GET /api/favorites
exports.getFavorites = async (req, res, next) => {
  try {
    const favorites = await db('favorites')
      .select(
        'favorites.id',
        'cars.*',
        'car_categories.name as category_name',
        'cities.name as city_name',
        'states.name as state_name'
      )
      .leftJoin('cars', 'favorites.car_id', 'cars.id')
      .leftJoin('car_categories', 'cars.category_id', 'car_categories.id')
      .leftJoin('cities', 'cars.city_id', 'cities.id')
      .leftJoin('states', 'cars.state_id', 'states.id')
      .where('favorites.user_id', req.user.id)
      .orderBy('favorites.created_at', 'desc');

    favorites.forEach((f) => {
      try { f.features = JSON.parse(f.features); } catch { f.features = []; }
    });

    res.json({ favorites });
  } catch (error) {
    next(error);
  }
};

// POST /api/favorites
exports.addFavorite = async (req, res, next) => {
  try {
    const { car_id } = req.body;
    const existing = await db('favorites').where({ user_id: req.user.id, car_id }).first();
    if (existing) return res.status(409).json({ error: 'Already in favorites' });

    const [fav] = await db('favorites')
      .insert({ user_id: req.user.id, car_id })
      .returning('*');

    res.status(201).json({ favorite: fav });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/favorites/:car_id
exports.removeFavorite = async (req, res, next) => {
  try {
    await db('favorites')
      .where({ user_id: req.user.id, car_id: req.params.car_id })
      .del();
    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    next(error);
  }
};

// GET /api/coupons/validate?code=&amount=
exports.validateCoupon = async (req, res, next) => {
  try {
    const { code, amount } = req.query;

    const coupon = await db('coupons')
      .where({ code, is_active: true })
      .where('valid_from', '<=', db.fn.now())
      .where('valid_until', '>=', db.fn.now())
      .first();

    if (!coupon) return res.status(404).json({ error: 'Invalid or expired coupon' });

    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({ error: 'Coupon usage limit reached' });
    }

    if (amount && parseFloat(amount) < parseFloat(coupon.min_order_value || 0)) {
      return res.status(400).json({ error: `Minimum order value is ₹${coupon.min_order_value}` });
    }

    let discount = 0;
    if (amount) {
      if (coupon.discount_type === 'percentage') {
        discount = Math.min(
          parseFloat(amount) * (coupon.discount_value / 100),
          coupon.max_discount || Infinity
        );
      } else {
        discount = coupon.discount_value;
      }
    }

    res.json({ coupon, discount: parseFloat(discount.toFixed(2)) });
  } catch (error) {
    next(error);
  }
};
