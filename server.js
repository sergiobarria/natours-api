const dotenv = require('dotenv');
const app = require('./app');
const colors = require('colors'); // eslint-disable-line

// Load env vars
dotenv.config({ path: './config.env' });

// Connect database
const connectDB = require('./config/db');

connectDB();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App running on port ${PORT}...`.yellow.bold);
});
