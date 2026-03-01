/**
 * WhatsApp Business Cloud API Service
 * Uses Meta's WhatsApp Cloud API to send template & text messages.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
const axios = require('axios');
const config = require('../config');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

const client = axios.create({
  baseURL: WHATSAPP_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth header dynamically (token may change)
client.interceptors.request.use((cfg) => {
  cfg.headers.Authorization = `Bearer ${config.whatsapp.accessToken}`;
  return cfg;
});

/**
 * Send a free-form text message (only works within 24-hour window)
 */
const sendTextMessage = async (to, text) => {
  try {
    const phoneNumberId = config.whatsapp.phoneNumberId;
    const response = await client.post(`/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizePhone(to),
      type: 'text',
      text: { preview_url: false, body: text },
    });
    console.log(`✅ WhatsApp text sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error('❌ WhatsApp text error:', error.response?.data || error.message);
    return null;
  }
};

/**
 * Send a template message (works outside 24-hour window)
 */
const sendTemplateMessage = async (to, templateName, languageCode = 'en', components = []) => {
  try {
    const phoneNumberId = config.whatsapp.phoneNumberId;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizePhone(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };
    if (components.length > 0) {
      payload.template.components = components;
    }
    const response = await client.post(`/${phoneNumberId}/messages`, payload);
    console.log(`✅ WhatsApp template "${templateName}" sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error('❌ WhatsApp template error:', error.response?.data || error.message);
    return null;
  }
};

// ────────────────────────────────────────────────
//  Pre-built notification helpers
// ────────────────────────────────────────────────

/**
 * Notify customer that their booking / ride has started
 */
const sendBookingStarted = async (phone, { customerName, bookingNumber, carName, driverName, pickupAddress }) => {
  const text =
    `🚗 *Ride Started!*\n\n` +
    `Hi ${customerName},\n` +
    `Your ride *#${bookingNumber}* has started.\n\n` +
    `🚘 *Car:* ${carName}\n` +
    `👤 *Driver:* ${driverName || 'Assigned driver'}\n` +
    `📍 *Pickup:* ${pickupAddress}\n\n` +
    `Have a safe journey! 🎉`;

  return sendTextMessage(phone, text);
};

/**
 * Notify customer that ride is completed
 */
const sendBookingCompleted = async (phone, { customerName, bookingNumber, totalAmount, dropAddress }) => {
  const text =
    `✅ *Ride Completed!*\n\n` +
    `Hi ${customerName},\n` +
    `Your ride *#${bookingNumber}* has been completed.\n\n` +
    `📍 *Drop:* ${dropAddress}\n` +
    `💰 *Total:* ₹${parseFloat(totalAmount).toFixed(2)}\n\n` +
    `Thank you for travelling with us! 🙏`;

  return sendTextMessage(phone, text);
};

/**
 * Ask for review 60 minutes after ride ends
 */
const sendReviewRequest = async (phone, { customerName, bookingNumber, carName }) => {
  const text =
    `⭐ *How was your ride?*\n\n` +
    `Hi ${customerName},\n` +
    `You completed ride *#${bookingNumber}* in *${carName}*.\n\n` +
    `We'd love your feedback! Please rate your experience in the app.\n\n` +
    `Your review helps us improve 🙌`;

  return sendTextMessage(phone, text);
};

// ── Helpers ──

/**
 * Normalize phone to E.164 format for WhatsApp API
 * Strips spaces/dashes, ensures country code prefix.
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-()]/g, '');
  // If starts with 0, assume India (+91)
  if (cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.substring(1);
  }
  // Remove leading +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

module.exports = {
  sendTextMessage,
  sendTemplateMessage,
  sendBookingStarted,
  sendBookingCompleted,
  sendReviewRequest,
};
