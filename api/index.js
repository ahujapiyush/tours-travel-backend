/**
 * Debug step 2: Basic Express + all middleware (no routes).
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use('/api/', limiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', step: 2 }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = app;
