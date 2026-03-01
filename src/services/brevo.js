/**
 * Brevo (formerly Sendinblue) Transactional Email Service
 * Uses Brevo HTTP API v3 to send transactional emails.
 * Docs: https://developers.brevo.com/reference
 */
const axios = require('axios');
const config = require('../config');

const BREVO_API_URL = 'https://api.brevo.com/v3';

const client = axios.create({
  baseURL: BREVO_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    accept: 'application/json',
  },
});

client.interceptors.request.use((cfg) => {
  cfg.headers['api-key'] = config.brevo.apiKey;
  return cfg;
});

/**
 * Send a transactional email via Brevo
 * @param {object} opts
 * @param {string} opts.to          - Recipient email
 * @param {string} opts.toName      - Recipient name
 * @param {string} opts.subject     - Email subject
 * @param {string} opts.htmlContent - HTML body
 * @param {string} [opts.textContent] - Plain-text fallback
 */
const sendEmail = async ({ to, toName, subject, htmlContent, textContent }) => {
  try {
    const payload = {
      sender: {
        name: config.brevo.senderName,
        email: config.brevo.senderEmail,
      },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent,
    };
    if (textContent) payload.textContent = textContent;

    const response = await client.post('/smtp/email', payload);
    console.log(`✅ Brevo email sent to ${to} — messageId: ${response.data?.messageId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Brevo email error:', error.response?.data || error.message);
    return null;
  }
};

// ────────────────────────────────────────────────
//  Pre-built email templates
// ────────────────────────────────────────────────

/**
 * Booking started email
 */
const sendBookingStartedEmail = async (email, { customerName, bookingNumber, carName, driverName, pickupAddress, pickupTime }) => {
  const subject = `🚗 Ride #${bookingNumber} has started!`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f8; padding: 20px;">
      <div style="max-width: 560px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 28px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">🚗 Your Ride Has Started!</h1>
        </div>
        <div style="padding: 28px 24px;">
          <p style="font-size: 16px; color: #333;">Hi <strong>${customerName}</strong>,</p>
          <p style="color: #555;">Your ride <strong>#${bookingNumber}</strong> is now in progress.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #888; width: 120px;">Car</td><td style="padding: 8px 0; color: #333; font-weight: 600;">${carName}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Driver</td><td style="padding: 8px 0; color: #333; font-weight: 600;">${driverName || 'Assigned driver'}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Pickup</td><td style="padding: 8px 0; color: #333;">${pickupAddress}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Time</td><td style="padding: 8px 0; color: #333;">${pickupTime ? new Date(pickupTime).toLocaleString('en-IN') : '-'}</td></tr>
          </table>
          <p style="color: #555;">Have a safe and comfortable journey! 🎉</p>
        </div>
        <div style="background: #f9fafb; padding: 16px 24px; text-align: center; color: #aaa; font-size: 12px;">
          Tours &amp; Travel &mdash; Your ride, your way.
        </div>
      </div>
    </body>
    </html>`;

  return sendEmail({ to: email, toName: customerName, subject, htmlContent });
};

/**
 * Booking completed email
 */
const sendBookingCompletedEmail = async (email, { customerName, bookingNumber, carName, totalAmount, dropAddress, distance, duration }) => {
  const subject = `✅ Ride #${bookingNumber} completed — ₹${parseFloat(totalAmount).toFixed(2)}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f8; padding: 20px;">
      <div style="max-width: 560px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 28px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">✅ Ride Completed!</h1>
        </div>
        <div style="padding: 28px 24px;">
          <p style="font-size: 16px; color: #333;">Hi <strong>${customerName}</strong>,</p>
          <p style="color: #555;">Your ride <strong>#${bookingNumber}</strong> has been completed successfully.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px 0; color: #888; width: 120px;">Car</td><td style="padding: 8px 0; color: #333; font-weight: 600;">${carName}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Drop-off</td><td style="padding: 8px 0; color: #333;">${dropAddress}</td></tr>
            ${distance ? `<tr><td style="padding: 8px 0; color: #888;">Distance</td><td style="padding: 8px 0; color: #333;">${distance} km</td></tr>` : ''}
            ${duration ? `<tr><td style="padding: 8px 0; color: #888;">Duration</td><td style="padding: 8px 0; color: #333;">${duration} min</td></tr>` : ''}
          </table>
          <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
            <span style="color: #888; font-size: 13px;">Total Amount</span><br>
            <span style="font-size: 28px; font-weight: 700; color: #059669;">₹${parseFloat(totalAmount).toFixed(2)}</span>
          </div>
          <p style="color: #555;">Thank you for travelling with us! 🙏</p>
        </div>
        <div style="background: #f9fafb; padding: 16px 24px; text-align: center; color: #aaa; font-size: 12px;">
          Tours &amp; Travel &mdash; Your ride, your way.
        </div>
      </div>
    </body>
    </html>`;

  return sendEmail({ to: email, toName: customerName, subject, htmlContent });
};

/**
 * Review request email — 60 minutes after ride ends
 */
const sendReviewRequestEmail = async (email, { customerName, bookingNumber, carName }) => {
  const subject = `⭐ How was your ride #${bookingNumber}? Share your feedback!`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6f8; padding: 20px;">
      <div style="max-width: 560px; margin: auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 28px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">⭐ Rate Your Ride</h1>
        </div>
        <div style="padding: 28px 24px; text-align: center;">
          <p style="font-size: 16px; color: #333;">Hi <strong>${customerName}</strong>,</p>
          <p style="color: #555;">You recently completed ride <strong>#${bookingNumber}</strong> in <strong>${carName}</strong>.</p>
          <p style="color: #555; margin: 20px 0;">We'd love to hear about your experience!</p>
          <div style="margin: 24px 0;">
            <span style="font-size: 36px;">⭐⭐⭐⭐⭐</span>
          </div>
          <p style="color: #555;">Open the <strong>Tours & Travel</strong> app to rate your ride and leave a review.</p>
          <p style="color: #888; font-size: 13px; margin-top: 24px;">Your feedback helps us improve and helps other travellers make better choices.</p>
        </div>
        <div style="background: #f9fafb; padding: 16px 24px; text-align: center; color: #aaa; font-size: 12px;">
          Tours &amp; Travel &mdash; Your ride, your way.
        </div>
      </div>
    </body>
    </html>`;

  return sendEmail({ to: email, toName: customerName, subject, htmlContent });
};

module.exports = {
  sendEmail,
  sendBookingStartedEmail,
  sendBookingCompletedEmail,
  sendReviewRequestEmail,
};
