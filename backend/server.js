const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

dotenv.config();

// Suppress harmless pdfjs-dist canvas warnings (canvas is only needed for
// visual rendering, NOT for text extraction which is all we use it for).
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
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded PDFs as static files
app.use('/uploads', express.static(UPLOADS_DIR));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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

  // Generic error handler
  console.error('Server Error:', err.message);
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
