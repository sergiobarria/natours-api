const dotenv = require('dotenv');
const colors = require('colors'); // eslint-disable-line

process.on('uncaughtException', () => {
  process.exit(1);
});

// Load env vars
dotenv.config({ path: './config.env' });

const app = require('./app');

// Connect database
const connectDB = require('./config/db');

connectDB();

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`App running on port ${PORT}...`.yellow.bold);
});

process.on('unhandledRejection', () => {
  // console.log('UNHANDLED REJECTION! Shutting down...');
  server.close(() => {
    process.exit(1);
  });
});
