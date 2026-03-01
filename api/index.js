/**
 * Vercel serverless entry point.
 * All requests are forwarded here via vercel.json rewrites.
 */
const app = require('../src/server');
module.exports = app;

