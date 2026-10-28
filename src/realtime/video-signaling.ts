import type { Server as HttpServer } from 'http';
import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { VIDEO_TOKEN_AUDIENCE, VideoJoinPayload } from '../services/video.service';

// WebRTC signalling for consultations. The server only relays offers, answers and ICE
// candidates between the two participants of one appointment. Media never passes through here.

const MAX_PARTICIPANTS = 2;
const roomFor = (appointmentId: string): string => `video:${appointmentId}`;

export const attachVideoSignaling = (httpServer: HttpServer, allowedOrigins: string[]): Server => {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: { origin: allowedOrigins },
    maxHttpBufferSize: 1_000_000,
  });

  const video = io.of('/video');

  // Only holders of a valid join token (issued by GET /consultation/appointments/:id/join) may connect.
  video.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string') return next(new Error('unauthorized'));

    try {
      const claims = jwt.verify(token, config.jwt.secret, {
        algorithms: ['HS256'],
        issuer: config.jwt.issuer,
        audience: VIDEO_TOKEN_AUDIENCE,
      }) as VideoJoinPayload & jwt.JwtPayload;

      if (claims.typ !== 'video' || !claims.appointmentId) return next(new Error('unauthorized'));

      socket.data.claims = claims;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  video.on('connection', (socket: Socket) => {
    const claims = socket.data.claims as VideoJoinPayload & jwt.JwtPayload;
    const room = roomFor(claims.appointmentId);
    const occupants = video.adapter.rooms.get(room)?.size ?? 0;

    if (occupants >= MAX_PARTICIPANTS) {
      socket.emit('room-full');
      socket.disconnect(true);
      return;
    }

    socket.join(room);
    socket.emit('joined', { role: claims.role, occupants: occupants + 1 });
    socket.to(room).emit('peer-joined', { role: claims.role, displayName: claims.displayName });

    // The join token expires at the end of the window; drop the socket then.
    const msUntilExpiry = (claims.exp ?? 0) * 1000 - Date.now();
    const expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(msUntilExpiry, 0));

    socket.on('signal', (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      socket.to(room).emit('signal', payload);
    });

    socket.on('disconnect', () => {
      clearTimeout(expiryTimer);
      socket.to(room).emit('peer-left', { role: claims.role });
      logger.info('Video participant left', { appointmentId: claims.appointmentId, role: claims.role });
    });

    logger.info('Video participant joined', { appointmentId: claims.appointmentId, role: claims.role });
  });

  return io;
};
