/**
 * Vercel serverless entry point.
 */
require('dotenv').config();

let handler;
try {
  const app = require('../src/server');
  handler = app;
} catch (e) {
  console.error('STARTUP CRASH:', e.message);
  handler = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ startup_error: e.message, stack: e.stack.split('\n').slice(0, 10) }));
  };
}

module.exports = handler;

