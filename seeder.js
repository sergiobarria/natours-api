/* eslint-disable */
const fs = require('fs');
// const connectDB = require('./config/db');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Tour = require('./models/tourModel');
const colors = require('colors');

// Load env vars
dotenv.config({ path: './config.env' });

// Connect to DB
const db = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose.connect(db, {
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
});

// Read json file
const tours = JSON.parse(
  fs.readFileSync(`${__dirname}/dev-data/data/tours-simple.json`, 'utf-8')
);

// Import data into db
const importData = async () => {
  try {
    await Tour.create(tours);
    console.log('Data successfully loaded into db'.green.inverse);
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

// Delete data from db
const deleteData = async () => {
  try {
    await Tour.deleteMany();
    console.log('Data successfully deleted!'.red.inverse);
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}
