const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'UtkriX Technologies API',
      version: '1.0.0',
      description: 'Public website content, contact, and account management API.',
    },
    servers: [{ url: 'http://localhost:5000', description: 'Development server' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
        Course: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            instructorId: { type: 'integer' },
            thumbnail: { type: 'string', nullable: true },
            price: { type: 'number', format: 'decimal' },
            isPublished: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string', maxLength: 150 },
            description: { type: 'string' },
            category: { type: 'string', maxLength: 80 },
            imageUrl: { type: 'string', nullable: true },
            projectUrl: { type: 'string', nullable: true },
            tags: { type: 'array', items: { type: 'string' } },
            isFeatured: { type: 'boolean' },
            isPublished: { type: 'boolean' },
            sortOrder: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ProjectUpdate: {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 150 },
            description: { type: 'string', maxLength: 5000 },
            category: { type: 'string', maxLength: 80 },
            imageUrl: { type: 'string', nullable: true },
            projectUrl: { type: 'string', format: 'uri', nullable: true },
            tags: { type: 'array', maxItems: 10, items: { type: 'string', maxLength: 40 } },
            isFeatured: { type: 'boolean' },
            isPublished: { type: 'boolean' },
            sortOrder: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./routes/*.js', './server.js'],
};

module.exports = swaggerJsdoc(options);
