/**
 * Polling endpoints — replace Socket.IO for Vercel serverless deployments.
 * Clients call these on an interval to get real-time-like updates.
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/poll/booking/:id
// Returns latest booking status + most recent tracking point.
// Client polls every 5s while tracking screen is open.
router.get('/booking/:id', authenticate, async (req, res, next) => {
  try {
    const booking = await db('bookings')
      .select(
        'bookings.*',
        'users.name as customer_name',
        'cars.name as car_name',
        'cars.brand as car_brand',
        'd_user.name as driver_name',
        'd_user.phone as driver_phone'
      )
      .leftJoin('users', 'bookings.customer_id', 'users.id')
      .leftJoin('cars', 'bookings.car_id', 'cars.id')
      .leftJoin('drivers', 'bookings.driver_id', 'drivers.id')
      .leftJoin('users as d_user', 'drivers.user_id', 'd_user.id')
      .where('bookings.id', req.params.id)
      .first();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Auth: customer can only poll own bookings
    if (req.user.role === 'customer' && booking.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Latest tracking point
    const location = await db('booking_tracking')
      .where({ booking_id: booking.id })
      .orderBy('recorded_at', 'desc')
      .first();

    res.json({ booking, location: location || null });
  } catch (err) {
    next(err);
  }
});

// GET /api/poll/notifications
// Returns unread notification count + latest 5 notifications.
// Client polls every 10s.
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const notifications = await db('notifications')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(5);

    const unreadCount = await db('notifications')
      .where({ user_id: req.user.id, is_read: false })
      .count('id as count')
      .first();

    res.json({
      notifications,
      unread_count: parseInt(unreadCount?.count || 0),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
