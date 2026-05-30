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

dotenv.config();

// Suppress harmless pdfjs-dist canvas warnings
const _origWarn = console.warn.bind(console);
console.warn = (...args) => {
  const msg = args[0] ? String(args[0]) : '';
  if (msg.includes('Cannot polyfill') && msg.includes('canvas')) return;
  _origWarn(...args);
};

// Auto-create required directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialize db.json if it doesn't exist
const DB_PATH = path.join(DATA_DIR, 'db.json');
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({ voters: [], pdfs: [] }, null, 2), 'utf8');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// CORS Whitelist Configuration
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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Tracing & Structured Logger Middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', req.id);
  logger.info(`${req.method} ${req.url}`, req.id);
  next();
});

// Rate Limiter to prevent brute-force and spamming
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'খুব বেশি রিকোয়েস্ট পাঠানো হয়েছে, দয়া করে ১৫ মিনিট পর আবার চেষ্টা করুন।'
  }
});
app.use('/api/', apiLimiter);

// Serve uploaded PDFs as static files
app.use('/uploads', express.static(UPLOADS_DIR));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/', (req, res) => res.send('Live Voter Search API - Local Storage Mode'));

// Routes
const voterRoutes = require('./routes/voterRoutes');
const authRoutes = require('./routes/authRoutes');
const pdfRoutes = require('./routes/pdfRoutes');

app.use('/api/voters', voterRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pdf', pdfRoutes);

// Multer error handler (must come after routes)
app.use((err, req, res, next) => {
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

  // Generic error handler using structured logger
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
