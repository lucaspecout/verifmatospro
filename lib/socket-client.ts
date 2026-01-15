import { io } from 'socket.io-client';

let socket: ReturnType<typeof io> | null = null;

export const emitLineUpdate = async (slug: string, baseUrl?: string | null) => {
  const url = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    return;
  }
  if (!socket) {
    socket = io(url, { path: '/api/socket/io', autoConnect: true });
    await new Promise<void>((resolve) => {
      socket?.on('connect', () => resolve());
    });
  }
  socket.emit('join', slug);
  socket.emit('line-updated', { slug });
};
