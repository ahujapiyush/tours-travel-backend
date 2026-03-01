const knex = require('knex');

// Resolve which environment config to use
// Fallback to 'development' if NODE_ENV is not 'production'
const isProduction = process.env.NODE_ENV === 'production';

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'tours_travel',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: (process.env.DB_SSL === 'true' || isProduction)
      ? { rejectUnauthorized: false }
      : false,
  },
  // pool.min=0 is essential for serverless: don't eagerly open connections
  pool: {
    min: 0,
    max: isProduction ? 2 : 5,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 600000,
  },
});

module.exports = db;
