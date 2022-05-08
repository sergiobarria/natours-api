/* eslint-disable no-console */
import mongoose from 'mongoose';
import 'colors';

import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI.replace(
  '<PASSWORD>',
  process.env.MONGO_USER_PASSWORD
);

// mongoose.connection.once('open', () => {
//   console.log(`MongoDB connection ready!`.cyan.underline.bold);
// });

mongoose.connection.on('error', (err) => {
  console.error(err);
});

// Connect to db
export async function mongoConnect() {
  await mongoose.connect(MONGO_URI);
}

// Disconnect from db
export async function mongoDisconnect() {
  await mongoose.disconnect();
}
