const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../config/database');

module.exports = function setupSocket(io) {
  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.user.email} (${socket.user.role})`);

    // Join personal room
    socket.join(`user_${socket.user.id}`);

    // Admins join admin room
    if (socket.user.role === 'admin') {
      socket.join('admins');
      console.log(`👑 Admin joined: ${socket.user.email}`);
    }

    // ── Join booking room ──
    socket.on('join_booking', (bookingId) => {
      socket.join(`booking_${bookingId}`);
      console.log(`📍 ${socket.user.email} joined booking_${bookingId}`);
    });

    socket.on('leave_booking', (bookingId) => {
      socket.leave(`booking_${bookingId}`);
    });

    // ── Live location updates from driver/car ──
    socket.on('location_update', async (data) => {
      const { booking_id, latitude, longitude, speed, heading } = data;

      try {
        // Save to tracking table
        await db('booking_tracking').insert({
          booking_id,
          latitude,
          longitude,
          speed,
          heading,
          recorded_at: db.fn.now(),
        });

        // Update driver location
        if (socket.user.role === 'driver') {
          await db('drivers')
            .where('user_id', socket.user.id)
            .update({ current_lat: latitude, current_lng: longitude });
        }

        // Broadcast to booking room
        io.to(`booking_${booking_id}`).emit('live_location', {
          booking_id,
          latitude,
          longitude,
          speed,
          heading,
          timestamp: new Date().toISOString(),
        });

        // Also send to admins
        io.to('admins').emit('driver_location', {
          booking_id,
          driver_id: socket.user.id,
          latitude,
          longitude,
          speed,
          heading,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Location update error:', error.message);
      }
    });

    // ── Car location update (for admin fleet tracking) ──
    socket.on('car_location_update', async (data) => {
      const { car_id, latitude, longitude } = data;
      try {
        await db('cars')
          .where({ id: car_id })
          .update({ current_lat: latitude, current_lng: longitude });

        io.to('admins').emit('car_location', {
          car_id,
          latitude,
          longitude,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Car location update error:', error.message);
      }
    });

    // ── Chat between customer and driver ──
    socket.on('booking_message', (data) => {
      const { booking_id, message } = data;
      io.to(`booking_${booking_id}`).emit('booking_message', {
        booking_id,
        sender_id: socket.user.id,
        sender_name: socket.user.email,
        message,
        timestamp: new Date().toISOString(),
      });
    });

    // ── ETA updates ──
    socket.on('eta_update', (data) => {
      const { booking_id, eta_minutes, distance_remaining } = data;
      io.to(`booking_${booking_id}`).emit('eta_update', {
        booking_id,
        eta_minutes,
        distance_remaining,
        timestamp: new Date().toISOString(),
      });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.user.email}`);
    });
  });
};
