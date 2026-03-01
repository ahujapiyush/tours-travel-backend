/**
 * Vercel serverless function entry point.
 * Imports the Express app and exports it as the default handler.
 * All HTTP requests are routed here via vercel.json rewrites.
 */
const app = require('../src/server');

module.exports = app;
