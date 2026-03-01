/**
 * Vercel serverless entry point.
 * All requests are forwarded here via vercel.json rewrites.
 */
require('dotenv').config();
const app = require('../src/server');
module.exports = app;

