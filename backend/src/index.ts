import http from 'http';
import { app } from './app.js';
import { setupSocketIO } from './socket/socketHandler.js';

const PORT = process.env.PORT || 5001;

const server = http.createServer(app);

// Initialize Socket.IO with HTTP server
setupSocketIO(server);

server.listen(PORT, () => {
  console.log(`[Backend Server] Running on http://localhost:${PORT}`);
  console.log(`[Backend Server] Health check available at http://localhost:${PORT}/api/health`);
});
