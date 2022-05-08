/* eslint-disable no-console */
import http from 'http';

import 'colors';
import dotenv from 'dotenv';

import app from './app.js';
import { mongoConnect } from './utils/mongoClient.js';

dotenv.config();

let server;
const PORT = process.env.PORT || 4000;

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

async function startServer() {
  server = http.createServer(app);

  await mongoConnect();

  server.listen(PORT, () =>
    console.log(
      `
    🚀 Express server running!
    🔉 Listening on port ${PORT}
    💾 MongoDB connection ready!
    📚 Documentation available on http://localhost:${PORT}/docs
  `.magenta.bold
    )
  );
}

process.on('unhandledRejection', (err) => {
  server.close(() => {
    console.log('UNHANDLED REJECTION! 💥 Shutting server down...');
    console.log(err);
    process.exit(1);
  });
});

startServer();
