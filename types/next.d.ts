import { Server as ServerIO } from 'socket.io';
import { Server as NetServer } from 'http';
import { Socket } from 'net';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL?: string;
      AUTH_SECRET?: string;
    }
  }
}

declare module 'http' {
  interface Server {
    io?: ServerIO;
  }
}

declare module 'next' {
  interface NextApiResponse {
    socket: Socket & {
      server: NetServer & {
        io?: ServerIO;
      };
    };
  }
}
