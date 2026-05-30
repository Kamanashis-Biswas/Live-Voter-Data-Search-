const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares Configuration ---

// Enable Cross-Origin Resource Sharing (CORS) for frontend interaction
app.use(cors());

// Built-in JSON parser middleware (no external body-parser required)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom Request Logger middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - Client IP: ${req.ip}`);
  next();
});

// --- API Router Endpoints ---

// Live Server Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    databaseSetup: {
      provider: 'Supabase',
      configured: !!process.env.SUPABASE_URL
    }
  });
});

// Initial greeting route
app.get('/', (req, res) => {
  res.send('Live Voter Search API Backend Server is operational.');
});

// --- Import & Mount Controllers/Routes ---
const voterRoutes = require('./routes/voterRoutes');
const authRoutes = require('./routes/authRoutes');
const pdfRoutes = require('./routes/pdfRoutes');

app.use('/api/voters', voterRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pdf', pdfRoutes);

// --- Global Centralized Error Fallback ---
app.use((err, req, res, next) => {
  console.error('💥 Server Error Intercepted:', err.stack || err);
  const responseCode = err.status || 500;
  res.status(responseCode).json({
    success: false,
    error: {
      message: err.message || 'An unexpected error occurred in backend operations.',
      code: responseCode,
      ...(process.env.NODE_ENV === 'development' && { details: err.stack })
    }
  });
});

// Start API Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Express Application running on port ${PORT}`);
  console.log(`🩺 Health check URI ready at: http://localhost:${PORT}/api/health`);
});
