import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/DATABASE.js';
import { errorLogger, errorHandler } from './middleware/error.js';

// Імпорт маршрутів
import stationsRoutes from './routes/stations.js';
import measurementsRoutes from './routes/measurements.js';
import saveEcoBotRoutes from './routes/saveecobot.js';
import airQualityRoutes from './routes/airquality.js';

// Завантаження змінних середовища
dotenv.config(); 

// Підключення до бази даних
connectDB(); 

// Створення Express додатку
const app = express(); 
const PORT = process.env.PORT || 5000; 

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Безпека HTTP заголовків 
app.use(helmet());

// CORS налаштування (дозволити запити з фронтенду)
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Парсинг тіла запиту JSON та URL-кодованих даних
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Логування запитів (тільки в development) 
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ============================================================================
// МАРШРУТИ
// ============================================================================

// Головний маршрут
app.get('/', (req, res) => { 
  // Відповідь з інформацією про API
  res.json({
    success: true,
    message: '🌱 Eco Monitoring API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      stations: '/api/stations',
      measurements: '/api/measurements',
      saveecobot: '/api/saveecobot'
    },
    health: '/health'
  }); 
}); 

// Health check
app.get('/health', async (req, res) => {
  try {
    // Перевірка підключення до бази даних
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// API маршрути
app.use('/api/stations', stationsRoutes);
app.use('/api/measurements', measurementsRoutes);
app.use('/api/saveecobot', saveEcoBotRoutes);
app.use('/api/airquality', airQualityRoutes);

// Обробка неіснуючих маршрутів
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not supported`,
    available_endpoints: ['/api/stations', '/api/measurements', '/api/saveecobot']
  });
});

// ============================================================================
// ОБРОБКА ПОМИЛОК
// ============================================================================

app.use(errorLogger); // Логування помилок
app.use(errorHandler); // Відправка відповіді з помилкою

// ============================================================================
// ЗАПУСК СЕРВЕРА
// ============================================================================

const server = app.listen(PORT, () => {
  console.log('🚀 ======================================');
  console.log(`🌱 Eco Monitoring API Server Started`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📖 Stations: http://localhost:${PORT}/api/stations`);
  console.log(`📈 Measurements: http://localhost:${PORT}/api/measurements`);
  console.log(`🔄 SaveEcoBot Sync: http://localhost:${PORT}/api/saveecobot/sync`);
  console.log('🚀 ======================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;