# 03 · Video Consultations: Internal Build

Written for: backend and frontend engineers, and the owner who signs off on data handling.

## 1. Decision

Build video consultations **in-house**. No third-party video API is used, so no vendor can change its prices, terms, or availability under us.

The stack:

- **Media:** WebRTC between the patient's and the doctor's browsers. Media is encrypted end to end with DTLS-SRTP and does not pass through our servers.
- **Signalling:** Socket.IO on the API server, in the `/video` namespace. It relays offers, answers, and ICE candidates only.
- **Relay (TURN/STUN):** a self-hosted `coturn` container, used only when a direct connection is blocked (for example, by some mobile networks).
- **Access control:** a short-lived join token, signed by the API, valid only for one appointment and only inside its join window.

Daily and Agora are no longer options.

## 2. Scope

- One-to-one calls only: one patient and one doctor per appointment.
- No recording. The server never stores audio or video.
- No chat inside the call in version 1.
- Audio-only fallback is not included in version 1.

## 3. Flow

```
Patient or doctor opens the appointment
    │
    │  GET /api/v1/consultation/appointments/:appointmentId/join
    │      ├─ caller must be the patient or the doctor on the appointment
    │      ├─ appointment must be active (not cancelled, rescheduled, or no-show)
    │      ├─ now must be inside the window: 15 min before start → 30 min after start
    │      ├─ signs a join token (HS256, audience careconnect-video, exp = window end)
    │      └─ returns joinToken + iceServers (STUN + TURN with 1-hour credentials)
    ▼
Browser opens Socket.IO /video with auth.token = joinToken
    │
    ├─ server verifies the token; rejects anything else
    ├─ server allows at most 2 sockets per appointment room ("room-full" otherwise)
    ├─ first participant waits; second participant triggers "peer-joined"
    ├─ first participant creates the offer; second answers
    ├─ ICE candidates are relayed both ways
    └─ server drops the socket when the join token expires (window closed)
```

## 4. Security rules

- The join token is the only credential for signalling. It is never stored by the server and expires at the end of the window.
- TURN credentials are time-limited. The username carries the expiry, and the password is an HMAC of the username under `VIDEO_TURN_SECRET`. No static TURN password reaches the browser.
- The coturn server is configured with `--use-auth-secret`, so it accepts only these credentials.
- Only participants of the appointment can get a token. Admins cannot join a clinical call.
- The signalling server relays opaque SDP and ICE payloads. It does not parse media and logs only the appointment id and role.
- Media is encrypted by WebRTC (DTLS-SRTP). The browser shows the call only inside the CareConnect page.

## 5. Code locations

| Piece | File |
|---|---|
| Join rules, token, TURN credentials | `careconect-bn/src/services/video.service.ts` |
| Join route | `careconect-bn/src/routes/consultation.router.ts` (`/appointments/:appointmentId/join`) |
| Signalling server | `careconect-bn/src/realtime/video-signaling.ts` |
| Server wiring | `careconect-bn/src/index.ts` (HTTP server shared with Socket.IO) |
| Browser call component | `careconect-frontend/src/components/consultation/VideoCall.tsx` |
| Join hook | `careconect-frontend/src/hooks/useVideo.ts` |
| TURN relay | `docker-compose.yml` (service `coturn`) |

## 6. Configuration

```
VIDEO_TURN_SECRET=                    # 32+ random characters; shared with coturn
VIDEO_STUN_URLS=stun:<coturn-host>:3478
VIDEO_TURN_URLS=turn:<coturn-host>:3478?transport=udp
VIDEO_JOIN_WINDOW_BEFORE_MIN=15
VIDEO_JOIN_WINDOW_AFTER_MIN=30
```

For production, `<coturn-host>` must be the public host or IP of the coturn server, and `VIDEO_PUBLIC_IP` must match it. Ports to open: 3478 (UDP and TCP) and 49160 to 49200 (UDP).

## 7. Testing

- Automated (passing): a signalling smoke test runs in the backend Docker image. It checks that an invalid token is rejected, that two participants can exchange an offer, that a third participant is refused, and that a different appointment gets its own room.
- To add: unit tests for the join window (before, inside, after, cancelled appointment), and for authorization (a patient who is not on the appointment is refused).
- Manual, before pilot: two laptops on different networks; one phone on mobile data (TURN path); Chrome, Firefox, and Safari; camera and microphone permission denied.

## 8. Go-live checklist

- [ ] `VIDEO_TURN_SECRET` set in the secret manager and in the coturn container
- [ ] coturn reachable on its public address; relay ports open
- [ ] Join window tested with real appointment times (Africa/Kigali, UTC+2)
- [ ] Two-party call tested across networks, including a TURN-only path
- [ ] Pilot clinic trial signed off

## 9. Open questions

- Whether the clinic wants a phone-call fallback when video fails (recommended: yes, a written procedure).
- Whether an audio-only mode is needed for low-bandwidth patients in version 2.
