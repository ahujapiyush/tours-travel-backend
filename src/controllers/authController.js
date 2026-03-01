const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role = 'customer', city_id, state_id } = req.body;

    const existing = await db('users').where({ email }).first();
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [user] = await db('users')
      .insert({ name, email, phone, password: hashedPassword, role, city_id, state_id, email_verified: true })
      .returning(['id', 'name', 'email', 'phone', 'role', 'created_at']);

    const token = generateToken(user);

    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await db('users').where({ email, is_active: true }).first();
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await db('users').where({ id: user.id }).update({ last_login: db.fn.now() });

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar_url: user.avatar_url,
        city_id: user.city_id,
        state_id: user.state_id,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
exports.getProfile = async (req, res, next) => {
  try {
    const user = await db('users')
      .select('id', 'name', 'email', 'phone', 'role', 'avatar_url', 'address', 'city_id', 'state_id', 'created_at')
      .where({ id: req.user.id })
      .first();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Attach city and state names
    if (user.city_id) {
      const city = await db('cities').where({ id: user.city_id }).first();
      user.city_name = city ? city.name : null;
    }
    if (user.state_id) {
      const state = await db('states').where({ id: user.state_id }).first();
      user.state_name = state ? state.name : null;
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address, city_id, state_id, avatar_url } = req.body;

    const [updated] = await db('users')
      .where({ id: req.user.id })
      .update({ name, phone, address, city_id, state_id, avatar_url, updated_at: db.fn.now() })
      .returning(['id', 'name', 'email', 'phone', 'address', 'city_id', 'state_id', 'avatar_url']);

    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await db('users').where({ id: req.user.id }).first();
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: req.user.id }).update({ password: hashed });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/push-token
exports.updatePushToken = async (req, res, next) => {
  try {
    const { push_token } = req.body;
    await db('users').where({ id: req.user.id }).update({ push_token });
    res.json({ message: 'Push token updated' });
  } catch (error) {
    next(error);
  }
};
