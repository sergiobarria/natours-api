const express = require('express');
const colors = require('colors'); // eslint-disable-line
const morgan = require('morgan');

// Import routers
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');

// Start express app
const app = express();

// Middlewares
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(express.json());

// Mounting Routers
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);

module.exports = app;
