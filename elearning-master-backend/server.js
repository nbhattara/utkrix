require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');

const { prisma, connectDB } = require('./config/prisma');
const swaggerSpec = require('./config/swagger');
const logger = require('./utils/logger');
const { generalLimiter } = require('./middleware/rateLimitMiddleware');
const requestId = require('./middleware/requestIdMiddleware');
const { sanitizeInput, hpp } = require('./middleware/sanitizeMiddleware');
const responseTime = require('./middleware/responseTimeMiddleware');
const AppError = require('./utils/AppError');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Sit behind one reverse proxy (Vercel/Nginx) in production so req.ip and
// rate limiting see the real client IP.
app.set('trust proxy', 1);
const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32)) {
  throw new Error('Production JWT_SECRET must contain at least 32 bytes');
}

if (isProduction && corsOrigins.includes('*')) {
  throw new Error('Production CORS_ORIGIN must specify explicit allowed origins');
}

// --------------------------------------------------
// Database
// --------------------------------------------------

const startServer = async () => {
  try {
    const connected = await connectDB();
    if (connected) {
      logger.info('Database connected successfully');
    } else {
      logger.warn('Database unavailable. Website and API documentation will load, but database-backed requests will fail.');
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
  }
};

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(helmet({
  // CSP stays off: the API serves JSON plus the Swagger UI HTML page, which
  // requires inline scripts. Other helmet headers remain enabled.
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (corsOrigins.includes('*')) {
      if (isProduction) {
        return callback(new AppError('Wildcard CORS not allowed in production', 403));
      }
      return callback(null, true);
    }

    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new AppError('Origin is not allowed by CORS policy', 403));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));

app.use(cookieParser());
app.use(compression());

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(requestId);
app.use(responseTime);
app.use(sanitizeInput);
app.use(hpp());

if (isProduction) {
  app.use(generalLimiter);
}

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// --------------------------------------------------
// Static uploaded files
// --------------------------------------------------

app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"), {
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      },
    })
);

// --------------------------------------------------
// Health check
// --------------------------------------------------

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Check API and database health
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API and database are available
 *       503:
 *         description: Database is unavailable
 */
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$connect();
    res.json({
      success: true,
      message: "API healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "API unhealthy",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

// --------------------------------------------------
// Routes
// --------------------------------------------------

app.use("/api/v1/auth", require("./routes/authRoutes"));
app.use("/api/v1/contact", require("./routes/contactRoutes"));
app.use("/api/v1/support", require("./routes/supportRoutes"));
app.use("/api/v1/notifications", require("./routes/notificationRoutes"));
app.use("/api/v1/classrooms", require("./routes/classroomRoutes"));
app.use("/api/v1/courses", require("./routes/courseRoutes"));
app.use("/api/v1/projects", require("./routes/projectRoutes"));
app.use("/api/v1/faqs", require("./routes/faqRoutes"));
app.use("/api/v1/team-members", require("./routes/teamMemberRoutes"));
app.use("/api/v1/stats", require("./routes/statsRoutes"));
app.use("/api/v1/uploads", require("./routes/uploadRoutes"));
app.use("/api/v1", require("./routes/dashboardRoutes"));

// --------------------------------------------------
// Swagger Documentation
// --------------------------------------------------

// Raw OpenAPI JSON, consumable by codegen tools (Postman, openapi-generator, etc.)
app.get('/api-docs.json', (req, res) => {
  res.type('application/json').send(swaggerSpec);
});

const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'E-Learning Platform API Documentation',
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
  },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));

// --------------------------------------------------
// 404
// --------------------------------------------------

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found"
    });
});

// --------------------------------------------------
// Error handler
// --------------------------------------------------

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    err.statusCode = 413;
  } else if (err.code && err.code.startsWith('LIMIT_')) {
    err.statusCode = 400;
  }
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  logger.error({
    message: err.message,
    stack: err.stack,
    requestId: req.id,
    url: req.originalUrl,
    method: req.method,
  });

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      stack: err.stack,
    });
  } else {
    res.status(err.statusCode).json({
      success: false,
      message: err.isOperational ? err.message : 'Internal server error',
    });
  }
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

const PORT = process.env.PORT || 5000;

// Export app for testing
module.exports = app;

// Only start server if this file is run directly
if (require.main === module) {
  const server = startServer().then(() => {
    const serverInstance = app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV} mode`);
    });

    // --------------------------------------------------
    // Graceful shutdown
    // --------------------------------------------------

    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      serverInstance.close(async () => {
        logger.info('HTTP server closed');

        try {
          await prisma.$disconnect();
          logger.info('Database connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during database shutdown:', error);
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return serverInstance;
  });
}
