const colors = require('colors'); // eslint-disable-line
const dotenv = require('dotenv');

// dotenv config should be required before requiring the app
dotenv.config({ path: './config.env' });
const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`App running on port ${PORT}...`.yellow.bold);
});
