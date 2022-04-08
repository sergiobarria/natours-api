import http from 'http';

import 'colors';
import dotenv from 'dotenv';

import app from './app.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function startServer() {
  const server = http.createServer(app);

  server.listen(PORT, () =>
    console.log(
      `
    🚀 Express server running!
    🔉 Listening on port ${PORT}
    📃 Documentation available on http://localhost:${PORT}/docs
  `.magenta.bold
    )
  );
}

startServer();
