const db = require('../config/database');

// GET /api/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unread_only } = req.query;
    const offset = (page - 1) * limit;

    let query = db('notifications').where({ user_id: req.user.id });
    if (unread_only === 'true') query = query.where({ is_read: false });

    const countResult = await query.clone().count('id as total').first();
    const total = parseInt(countResult.total);

    const notifications = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

    const unreadCount = await db('notifications')
      .where({ user_id: req.user.id, is_read: false })
      .count('id as count')
      .first();

    res.json({
      notifications,
      unread_count: parseInt(unreadCount.count),
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/notifications/:id/read
exports.markAsRead = async (req, res, next) => {
  try {
    await db('notifications')
      .where({ id: req.params.id, user_id: req.user.id })
      .update({ is_read: true });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/notifications/read-all
exports.markAllAsRead = async (req, res, next) => {
  try {
    await db('notifications')
      .where({ user_id: req.user.id, is_read: false })
      .update({ is_read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};
