const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const logger = require('./utils/logger');

/**
 * @file server.js
 * @description Main entry point for the Live Voter Search API.
 * Configures the Express.js HTTP container, security sandboxing, 
 * rate limiters, structured tracing log middlewares, static files, 
 * and maps routing tables.
 * 
 * SECURITY IMPLEMENTATIONS:
 *   - Helmet.js is configured to prevent cross-origin resource policy blocks and set security headers.
 *   - Rate Limiter enforces safe traffic thresholds (200 requests per 15 mins) to prevent DDoS spamming.
 *   - CORS Whitelist allows only recognized local React ports (5173, 3000) with cookie credentials.
 *   - Global trace IDs are attached to all request pipelines (`x-request-id`) for audit tracking.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

dotenv.config();

// Override default warning logs: Suppress harmless PDF.js warnings
// regarding canvas rendering when canvas is unavailable or un-polyfilled in headless environments.
const _origWarn = console.warn.bind(console);
console.warn = (...args) => {
  const msg = args[0] ? String(args[0]) : '';
  if (msg.includes('Cannot polyfill') && msg.includes('canvas')) return;
  _origWarn(...args);
};

// AUTO-INITIALIZER: Verify and create standard storage paths for PDFs and DB JSONs
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// DATABASE BOOTSTRAP: Ensure db.json exists on disk, initializing with empty collections
const DB_PATH = path.join(DATA_DIR, 'db.json');
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ voters: [], pdfs: [] }, null, 2), 'utf8');
}

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Middlewares ─────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow frontend canvas to load static PDF buffers
  contentSecurityPolicy: false,                          // Keep disabled to let CDN unpkg scripts run freely
}));

// CORS Whitelist: Restrict incoming network queries to trusted local dev servers
const corsOptions = {
  origin: (origin, callback) => {
    const whitelist = [
      'http://localhost:5173', 
      'http://127.0.0.1:5173', 
      'http://localhost:3000', 
      'http://127.0.0.1:3000', 
      'http://localhost:5000'
    ];
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Parsing parameters with explicit payload boundary safeguards
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Tracing and Structured Logger Middleware:
// Generates and assigns a unique request-id header for full tracking down the middleware stacks.
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  logger.info(`${req.method} ${req.url}`, req.id);
  next();
});

// Rate Limiter: Enforces safe usage bounds (max 200 requests/15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 200, 
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'খুব বেশি রিকোয়েস্ট পাঠানো হয়েছে, দয়া করে ১৫ মিনিট পর আবার চেষ্টা করুন।'
  }
});
app.use('/api/', apiLimiter);

// STATIC FILES MOUNT: Serves uploaded PDFs securely to client viewport canvas
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Diagnostics and Status Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/', (req, res) => res.send('Live Voter Search API - Local Storage Mode'));

// ── Routing Maps ─────────────────────────────────────────────────────────────
const voterRoutes = require('./routes/voterRoutes');
const authRoutes = require('./routes/authRoutes');
const pdfRoutes = require('./routes/pdfRoutes');

app.use('/api/voters', voterRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pdf', pdfRoutes);

// ── Global Error Catchment & Multer Handling ─────────────────────────────────
app.use((err, req, res, next) => {
  // Gracefully translate size or file-type errors from Multer uploads to clean Bengali alerts
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'ফাইলের আকার সর্বোচ্চ ৫০ MB হতে পারে।'
      });
    }
    return res.status(400).json({
      success: false,
      message: `আপলোড সমস্যা: ${err.message}`
    });
  }

  // Catch-all unhandled handler logging clean details to structured logger files
  logger.error('Unhandled Error caught in middleware', err, req.id);
  res.status(err.status || 500).json({
    success: false,
    error: { message: err.message || 'Server error', code: err.status || 500 }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 PDF uploads directory: ${UPLOADS_DIR}`);
  console.log(`🗄️  Local database: ${DB_PATH}`);
});

// Trigger nodemon reload for database coordinate caches
