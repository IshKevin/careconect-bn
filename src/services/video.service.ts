import { createHmac } from 'crypto';
import { eq } from 'drizzle-orm';
import * as jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { config } from '../config/env';
import { appointments, doctors, userProfiles } from '../db/schemas';
import { AuthorizationError, ExternalServiceError, NotFoundError, ValidationError } from '../utils/errors';

// Internal video consultations. Media is WebRTC between the two browsers (encrypted with
// DTLS-SRTP). This service only authorises the call and issues credentials; signalling runs
// on this server (see src/realtime/video-signaling.ts). No third-party video API is used.

// Africa/Kigali is UTC+2 all year (no daylight saving). Appointment times are stored
// as local date and time, so the window is computed with this fixed offset.
const KIGALI_OFFSET = '+02:00';

export const VIDEO_TOKEN_AUDIENCE = 'careconnect-video';

export interface JoinRequester {
  userId: string;
  userType: string;
}

export interface VideoJoinPayload {
  typ: 'video';
  appointmentId: string;
  userId: string;
  role: 'doctor' | 'patient';
  displayName: string;
}

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface JoinConsultationResult {
  appointmentId: string;
  joinToken: string;
  iceServers: IceServer[];
  expiresAt: string;
  isOwner: boolean;
}

/**
 * Short-lived TURN credentials (coturn "use-auth-secret" scheme): the username carries the
 * expiry, and the password is an HMAC of it. No long-lived TURN password is shared with clients.
 */
export const turnCredentials = (userId: string, expUnix: number, secret: string): { username: string; credential: string } => {
  const username = `${expUnix}:${userId}`;
  const credential = createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
};

export class VideoService {
  /** Checks the join rules and returns a signed join token plus ICE servers. */
  async joinConsultation(appointmentId: string, requester: JoinRequester): Promise<JoinConsultationResult> {
    const [row] = await db
      .select({
        appointmentId: appointments.appointmentId,
        patientId: appointments.patientId,
        status: appointments.appointmentStatus,
        scheduledDate: appointments.scheduledDate,
        scheduledTime: appointments.scheduledTime,
        doctorUserId: doctors.userId,
        patientFirstName: userProfiles.firstName,
      })
      .from(appointments)
      .innerJoin(doctors, eq(doctors.doctorId, appointments.doctorId))
      .leftJoin(userProfiles, eq(userProfiles.userId, appointments.patientId))
      .where(eq(appointments.appointmentId, appointmentId))
      .limit(1);

    if (!row) throw new NotFoundError('Appointment');

    const isPatient = requester.userType === 'patient' && row.patientId === requester.userId;
    const isDoctor = requester.userType === 'doctor' && row.doctorUserId === requester.userId;
    if (!isPatient && !isDoctor) {
      throw new AuthorizationError('Only the patient and doctor on this appointment can join');
    }

    if (['cancelled', 'rescheduled', 'no_show'].includes(row.status)) {
      throw new ValidationError('This appointment is no longer active');
    }

    const startMs = Date.parse(`${row.scheduledDate}T${row.scheduledTime}${KIGALI_OFFSET}`);
    const opensMs = startMs - config.video.joinWindowBeforeMin * 60_000;
    const closesMs = startMs + config.video.joinWindowAfterMin * 60_000;
    const nowMs = Date.now();

    if (nowMs < opensMs) {
      throw new AuthorizationError(`The video call opens at ${new Date(opensMs).toISOString()}`);
    }
    if (nowMs > closesMs) {
      throw new AuthorizationError('The video call window for this appointment has closed');
    }

    const secret = config.video.turnSecret;
    if (!secret) {
      throw new ExternalServiceError('Video', 'not configured: VIDEO_TURN_SECRET is missing');
    }

    const role: 'doctor' | 'patient' = isDoctor ? 'doctor' : 'patient';
    const expUnix = Math.floor(closesMs / 1000);
    const payload: VideoJoinPayload = {
      typ: 'video',
      appointmentId,
      userId: requester.userId,
      role,
      displayName: isDoctor ? 'Doctor' : row.patientFirstName ?? 'Patient',
    };

    const joinToken = jwt.sign({ ...payload, exp: expUnix }, config.jwt.secret, {
      algorithm: 'HS256',
      issuer: config.jwt.issuer,
      audience: VIDEO_TOKEN_AUDIENCE,
    });

    const turn = turnCredentials(requester.userId, expUnix, secret);
    const iceServers: IceServer[] = [
      { urls: config.video.stunUrls },
      { urls: config.video.turnUrls, username: turn.username, credential: turn.credential },
    ];

    return {
      appointmentId,
      joinToken,
      iceServers,
      expiresAt: new Date(closesMs).toISOString(),
      isOwner: isDoctor,
    };
  }
}

export const videoService = new VideoService();
