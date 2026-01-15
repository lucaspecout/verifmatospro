import { Server as NetServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as ServerIO } from 'socket.io';

export const config = {
  api: {
    bodyParser: false
  }
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket.server.io) {
    const httpServer: NetServer = res.socket.server as unknown as NetServer;
    const io = new ServerIO(httpServer, {
      path: '/api/socket/io',
      addTrailingSlash: false
    });

    io.on('connection', (socket) => {
      socket.on('join', (slug: string) => {
        socket.join(slug);
      });
      socket.on('line-updated', ({ slug }) => {
        io.to(slug).emit('line-updated');
      });
    });

    res.socket.server.io = io;
  }
  res.end();
}
