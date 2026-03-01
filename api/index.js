/**
 * Debug: wrap server import to capture startup crash message.
 */
require('dotenv').config();

let handler;
try {
  const app = require('../src/server');
  handler = app;
} catch (e) {
  console.error('STARTUP CRASH:', e.message, '\n', e.stack);
  handler = (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ startup_error: e.message, stack: e.stack.split('\n').slice(0, 8) }));
  };
}

module.exports = handler;
