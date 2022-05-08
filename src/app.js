/* eslint-disable no-console */
import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerDocs from '../swagger.json';

import { APIError } from './utils/apiError.js';
import { errorHandler } from './middleware/error.controller.js';

import tourRoutes from './routes/tour.routes.js';
import userRoutes from './routes/user.routes.js';

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config();

// Create Express app
const app = express();

// Apply Middleware
app.use(express.json());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Apply Routes
app.use('/api/v1/tours', tourRoutes);
app.use('/api/v1/users', userRoutes);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.all('*', (req, res, next) => {
  next(new APIError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(errorHandler);

export default app;
