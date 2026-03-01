/**
 * Review Scheduler
 * Polls `scheduled_notifications` table every minute and dispatches
 * pending review requests whose send_at time has passed.
 * NOTE: setInterval is skipped on Vercel serverless — only runs when
 * the process is long-lived (local / Railway / Render).
 */
const db = require('../config/database');
const { sendReviewReminder } = require('./notificationService');

let intervalHandle = null;
const POLL_INTERVAL_MS = 60 * 1000; // 1 minute

const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

/**
 * Start the review scheduler polling loop
 */
const start = async () => {
  if (isServerless) {
    console.log('⏭ Review scheduler skipped (serverless environment)');
    return;
  }

  // Ensure the scheduled_notifications table exists
  const exists = await db.schema.hasTable('scheduled_notifications');
  if (!exists) {
    await db.schema.createTable('scheduled_notifications', (t) => {
      t.increments('id').primary();
      t.uuid('booking_id').references('id').inTable('bookings').onDelete('CASCADE');
      t.string('type', 50).notNullable().defaultTo('review_request');
      t.timestamp('send_at').notNullable();
      t.enum('status', ['pending', 'sent', 'failed', 'skipped']).defaultTo('pending');
      t.integer('attempts').defaultTo(0);
      t.timestamps(true, true);
    });
    console.log('📋 Created scheduled_notifications table');
  }

  console.log('⏰ Review scheduler started (polling every 60s)');

  // Initial run
  await processQueue();

  // Then poll
  intervalHandle = setInterval(processQueue, POLL_INTERVAL_MS);
};

/**
 * Process all pending scheduled notifications that are due
 */
const processQueue = async () => {
  try {
    const now = new Date();
    const pending = await db('scheduled_notifications')
      .where('status', 'pending')
      .where('send_at', '<=', now)
      .where('attempts', '<', 3)
      .limit(20);

    if (pending.length === 0) return;

    console.log(`⏰ Processing ${pending.length} scheduled notification(s)…`);

    for (const item of pending) {
      try {
        await sendReviewReminder(item.booking_id);

        await db('scheduled_notifications')
          .where({ id: item.id })
          .update({ status: 'sent', attempts: item.attempts + 1, updated_at: db.fn.now() });
      } catch (error) {
        console.error(`Failed to send scheduled notification ${item.id}:`, error.message);
        await db('scheduled_notifications')
          .where({ id: item.id })
          .update({
            attempts: item.attempts + 1,
            status: item.attempts + 1 >= 3 ? 'failed' : 'pending',
            updated_at: db.fn.now(),
          });
      }
    }
  } catch (error) {
    console.error('Review scheduler processQueue error:', error.message);
  }
};

/**
 * Stop the scheduler
 */
const stop = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('⏰ Review scheduler stopped');
  }
};

module.exports = { start, stop };
