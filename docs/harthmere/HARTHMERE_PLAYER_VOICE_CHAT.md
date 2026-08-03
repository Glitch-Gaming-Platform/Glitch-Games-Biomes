# Harthmere Player Voice Chat

Biomes now has opt-in proximity voice chat between authenticated players.

## Player experience

- Voice chat is off by default.
- Use the microphone button directly below the minimap, or press **F8**, to
  toggle voice on and off.
- Allow browser microphone access when prompted.
- **V remains the Inbox key** and is never captured by voice chat.
- The microphone control is hidden on mobile/touch-control layouts and in
  browsers without secure `getUserMedia` and WebRTC support.
- Voices are full volume within 8 world units, use a speech-friendly curved
  falloff to silence at 32 units, and the WebRTC peer is closed after players
  move more than 44 units apart.
- Music and effects duck briefly while inbound WebRTC audio levels indicate
  that another player is actually speaking.
- The existing microphone selector controls both NPC speech input and player
  voice input. Player voice has its own output-volume slider.

## Architecture

The implementation follows the Glitch multiplayer voice contract for title
`42de534c-600f-4228-af9e-b69faef94cce`:

1. List active `glitch_relay` / `proximity` voice rooms.
2. Join a non-full Biomes room, or create one when none is available.
3. Keep the returned participant `voice_token` in tab-scoped session storage so
   a reconnect can rotate the existing participant token without another room
   discovery pass.
4. Heartbeat participant mute/speaking/sequence state every 15 seconds.
5. Use Glitch `control`, `offer`, `answer`, and `ice` packets for WebRTC
   discovery and targeted signaling. ICE requests are sent concurrently instead
   of waiting behind one global promise queue.
6. Send microphone audio peer-to-peer through browser WebRTC/Opus.
7. Poll ordered Glitch packets for reconnect recovery and signaling fallback.
8. Leave the voice room and stop every microphone track on disable/unmount.

The existing Next.js Glitch bridge supplies the runtime title token for room
list/create/join calls. Participant heartbeat, packet, poll, and leave calls use
only the participant `voice_token`, as required by the Glitch API. The server
derives `player_id` from the authenticated Biomes session rather than trusting
a client-supplied identity.

## Configuration

The existing server-side `GLITCH_TITLE_TOKEN` is required. Add the real runtime
install-purpose title token to the deployment secret named
`GLITCH_TITLE_TOKEN`; never commit it.

Glitch injects the platform TURN relay into new rooms. The game-specific
override remains available for local or alternate deployments:

```bash
GLITCH_VOICE_ICE_SERVERS_JSON=[{"urls":"turn:turn.example.com:3478","username":"runtime-user","credential":"runtime-credential"}]
```

When this value is absent, the room omits its title override and the Glitch API
adds platform STUN plus time-limited TURN credentials. See the backend
`documentation/multiplayer-voice-turn.md` runbook.

## Privacy and moderation defaults

- Microphone capture is opt-in and starts only after the player toggles it on.
- Local audio tracks remain disabled whenever the minimap control is off.
- Voice-room recording is disabled.
- Glitch voice-room moderation is enabled.
- Remote audio elements and peer connections are destroyed when out of range,
  voice is disabled, the component unmounts, or a connection fails.
- Voice tokens and title tokens are never logged.
- WebRTC diagnostics log connection state, relay/direct candidate type, RTT,
  jitter, packet loss, distance, and effective playback volume every 10 seconds;
  credentials, SDP, ICE addresses, and tokens are not logged.

## Focused verification

```bash
scripts/harthmere/t.sh file src/server/glitch/test/harthmere_voice.test.ts
scripts/harthmere/t.sh file src/client/game/voice/player_voice_chat.test.ts
scripts/harthmere/t.sh file src/client/components/system/PlayerCommunicationHUD.browser.test.tsx
scripts/harthmere/t.sh types
```

For a live two-player check, open the game in two authenticated browser
profiles and move the players within 32 units. Toggle the minimap microphone or
press F8 in one profile and confirm the second profile hears audio, then move
beyond 32 units and confirm it fades to silence. Block direct UDP for one
profile and confirm the diagnostics select a `relay` candidate.
