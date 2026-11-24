import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

/**
 * Returns a singleton Socket.IO client instance.
 * Automatically connects to the current host and port (proxied to backend in Vite).
 */
export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
  }
  return socketInstance;
}
