import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerDocs from '../swagger.json';

import tourRoutes from './routes/tour.routes.js';
import userRoutes from './routes/user.routes.js';

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

app.get('/', (req, res) => {
  res.status(200).send('Hello from the Express Server!...');
});

export default app;
