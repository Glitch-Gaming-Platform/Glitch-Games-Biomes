import type { ClientResources } from "@/client/game/resources/types";
import { harthmereBiomesAuthHeaders } from "@/shared/util/harthmere_auth_session";
import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { dist } from "@/shared/math/linear";
import { clamp } from "lodash";

export const PLAYER_VOICE_TOGGLE_CODE = "F8";
export const PLAYER_VOICE_TOGGLE_LABEL = "F8";
export const PLAYER_VOICE_FULL_VOLUME_RADIUS = 4;
export const PLAYER_VOICE_AUDIBLE_RADIUS = 24;
export const PLAYER_VOICE_PEER_CONNECT_RADIUS = 32;
export const PLAYER_VOICE_PEER_DISCONNECT_RADIUS = 40;

const PLAYER_VOICE_HEARTBEAT_MS = 15_000;
const PLAYER_VOICE_HELLO_MS = 8_000;
const PLAYER_VOICE_POLL_MS = 500;
const PLAYER_VOICE_SPATIAL_UPDATE_MS = 250;

export function playerVoiceControlAvailable(input: {
  showVirtualJoystick: boolean;
  isSecureContext: boolean;
  hasGetUserMedia: boolean;
  hasRTCPeerConnection: boolean;
}) {
  return (
    !input.showVirtualJoystick &&
    input.isSecureContext &&
    input.hasGetUserMedia &&
    input.hasRTCPeerConnection
  );
}

type VoicePacketType =
  "audio" | "speaking" | "mute_state" | "offer" | "answer" | "ice" | "control";

type VoiceParticipant = {
  player_id: string;
  status?: string;
};

type VoiceRoom = {
  id: string;
  connection_config?: Record<string, unknown>;
  participants?: VoiceParticipant[];
};

type VoicePacket = {
  player_id: string;
  packet_type: VoicePacketType;
  payload: string;
  sequence: number;
};

type VoiceJoinResponse = {
  ok: boolean;
  available?: boolean;
  reason?: string;
  voice_room?: VoiceRoom;
  participant?: VoiceParticipant;
  voice_token?: string;
};

type PlayerVoiceSignalPayload = {
  version: 1;
  from: string;
  to?: string;
  kind?: "hello" | "bye";
  speaking?: boolean;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type VoicePeer = {
  connection: RTCPeerConnection;
  audio?: HTMLAudioElement;
  pendingCandidates: RTCIceCandidateInit[];
  makingOffer: boolean;
};

export type PlayerVoiceStatusState =
  | "off"
  | "requesting_permission"
  | "joining"
  | "connected"
  | "reconnecting"
  | "error";

export type PlayerVoiceStatus = {
  state: PlayerVoiceStatusState;
  speaking: boolean;
  peerCount: number;
  message?: string;
};

type PlayerVoiceClientDeps = {
  userId: BiomesId;
  displayName: string;
  resources: ClientResources;
  microphoneDeviceId?: string;
  getOutputVolume: () => number;
  onStatus: (status: PlayerVoiceStatus) => void;
};

class PlayerVoiceRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function voicePacketsFromResponse(raw: unknown): VoicePacket[] {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(asRecord(raw)?.data)
      ? (asRecord(raw)?.data as unknown[])
      : [];
  return rows.filter((row): row is VoicePacket => {
    const record = asRecord(row);
    return Boolean(
      record &&
      typeof record.player_id === "string" &&
      typeof record.packet_type === "string" &&
      typeof record.payload === "string" &&
      Number.isFinite(Number(record.sequence))
    );
  });
}

async function playerVoiceRequest<T>(
  op: string,
  body: Record<string, unknown>,
  keepalive = false
): Promise<T> {
  const response = await fetch("/api/glitch/harthmere", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...harthmereBiomesAuthHeaders("/api/glitch/harthmere"),
    },
    credentials: "same-origin",
    body: JSON.stringify({ op, ...body }),
    keepalive,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new PlayerVoiceRequestError(
      String(
        json?.message ??
          json?.error ??
          `Player voice request failed (${response.status})`
      ),
      response.status
    );
  }
  return json as T;
}

export function playerVoiceProximityVolume(
  distance: number,
  outputVolume: number
) {
  if (!Number.isFinite(distance) || !Number.isFinite(outputVolume)) {
    return 0;
  }
  if (distance <= PLAYER_VOICE_FULL_VOLUME_RADIUS) {
    return clamp(outputVolume, 0, 1);
  }
  const falloffDistance =
    PLAYER_VOICE_AUDIBLE_RADIUS - PLAYER_VOICE_FULL_VOLUME_RADIUS;
  return clamp(
    ((PLAYER_VOICE_AUDIBLE_RADIUS - distance) / falloffDistance) * outputVolume,
    0,
    1
  );
}

export function shouldInitiatePlayerVoiceOffer(
  localPlayerId: string,
  remotePlayerId: string
) {
  return localPlayerId.localeCompare(remotePlayerId) < 0;
}

export function shouldMaintainPlayerVoicePeer(distance: number) {
  return (
    Number.isFinite(distance) && distance <= PLAYER_VOICE_PEER_DISCONNECT_RADIUS
  );
}

export function parsePlayerVoiceSignalPayload(
  raw: string
): PlayerVoiceSignalPayload | undefined {
  try {
    const value = asRecord(JSON.parse(raw));
    if (
      value?.version !== 1 ||
      typeof value.from !== "string" ||
      (value.to !== undefined && typeof value.to !== "string")
    ) {
      return undefined;
    }
    return value as PlayerVoiceSignalPayload;
  } catch {
    return undefined;
  }
}

export function playerVoiceIceServersFromConfig(
  connectionConfig: Record<string, unknown> | undefined
): RTCIceServer[] {
  const candidates =
    connectionConfig?.iceServers ?? connectionConfig?.ice_servers;
  if (!Array.isArray(candidates)) {
    return [];
  }
  return candidates.flatMap((candidate) => {
    const record = asRecord(candidate);
    const urls = record?.urls;
    const validUrls =
      typeof urls === "string"
        ? urls.length > 0
        : Array.isArray(urls) &&
          urls.length > 0 &&
          urls.every((url) => typeof url === "string" && url.length > 0);
    if (!record || !validUrls) {
      return [];
    }
    return [
      {
        urls: urls as string | string[],
        ...(typeof record.username === "string"
          ? { username: record.username }
          : {}),
        ...(typeof record.credential === "string"
          ? { credential: record.credential }
          : {}),
      },
    ];
  });
}

export class GlitchPlayerVoiceClient {
  private stopped = true;
  private speaking = false;
  private localStream?: MediaStream;
  private voiceRoom?: VoiceRoom;
  private voiceToken?: string;
  private lastSequence = 0;
  private iceServers: RTCIceServer[] = [];
  private peers = new Map<string, VoicePeer>();
  private heartbeatTimer?: number;
  private helloTimer?: number;
  private pollTimer?: number;
  private spatialTimer?: number;
  private reconnectTimer?: number;
  private signalQueue = Promise.resolve();
  private reconnectAttempts = 0;

  constructor(private readonly deps: PlayerVoiceClientDeps) {}

  private get localPlayerId() {
    return String(this.deps.userId);
  }

  private connectedPeerCount() {
    let connected = 0;
    for (const peer of this.peers.values()) {
      if (peer.connection.connectionState === "connected") {
        connected += 1;
      }
    }
    return connected;
  }

  private emitStatus(state: PlayerVoiceStatusState, message?: string): void {
    this.deps.onStatus({
      state,
      speaking: this.speaking,
      peerCount: this.connectedPeerCount(),
      message,
    });
  }

  async start() {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    this.emitStatus("joining");
    try {
      const config = await playerVoiceRequest<{ enabled?: boolean }>(
        "config",
        {}
      );
      if (!config.enabled) {
        throw new Error(
          "Player voice chat needs GLITCH_TITLE_TOKEN to be configured."
        );
      }
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof RTCPeerConnection === "undefined"
      ) {
        throw new Error("This browser does not support microphone voice chat.");
      }
      this.emitStatus("requesting_permission");
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(this.deps.microphoneDeviceId
            ? { deviceId: { exact: this.deps.microphoneDeviceId } }
            : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      this.setLocalTrackEnabled(false);
      document.addEventListener("pointerdown", this.retryAudioPlayback, true);
      this.emitStatus("joining");
      await this.joinVoiceRoom();
      this.startTimers();
      await this.sendHello();
      this.emitStatus("connected");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Player voice chat failed.";
      await this.stop(false);
      this.emitStatus("error", message);
      throw error;
    }
  }

  async stop(sendLeave = true) {
    if (this.stopped && !this.localStream && !this.voiceToken) {
      return;
    }
    this.stopped = true;
    this.clearTimers();
    document.removeEventListener("pointerdown", this.retryAudioPlayback, true);
    this.speaking = false;
    this.setLocalTrackEnabled(false);
    const token = this.voiceToken;
    if (sendLeave && token) {
      await playerVoiceRequest(
        "voiceLeave",
        { voice_token: token },
        true
      ).catch(() => undefined);
    }
    this.voiceToken = undefined;
    this.voiceRoom = undefined;
    this.closeAllPeers();
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = undefined;
    this.emitStatus("off");
  }

  setSpeaking(speaking: boolean) {
    const next = Boolean(speaking && !this.stopped && this.localStream);
    if (next === this.speaking) {
      return;
    }
    this.speaking = next;
    this.setLocalTrackEnabled(next);
    this.emitStatus(this.voiceToken ? "connected" : "reconnecting");
    void this.sendHeartbeat();
    void this.sendPacket(
      "speaking",
      JSON.stringify({
        version: 1,
        from: this.localPlayerId,
        speaking: next,
      } satisfies PlayerVoiceSignalPayload)
    );
  }

  private setLocalTrackEnabled(enabled: boolean) {
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  private async joinVoiceRoom() {
    const response = await playerVoiceRequest<VoiceJoinResponse>("voiceJoin", {
      display_name: this.deps.displayName,
    });
    if (
      response.available === false ||
      !response.ok ||
      !response.voice_room ||
      !response.voice_token
    ) {
      throw new PlayerVoiceRequestError(
        response.reason === "missing_server_title_token"
          ? "Player voice chat needs GLITCH_TITLE_TOKEN to be configured."
          : "Player voice chat is currently unavailable."
      );
    }
    this.voiceRoom = response.voice_room;
    this.voiceToken = response.voice_token;
    this.lastSequence = 0;
    this.iceServers = playerVoiceIceServersFromConfig(
      response.voice_room.connection_config
    );
    this.reconnectAttempts = 0;

    for (const participant of response.voice_room.participants ?? []) {
      if (
        participant.player_id !== this.localPlayerId &&
        participant.status !== "left" &&
        this.peerDistance(participant.player_id) <=
          PLAYER_VOICE_PEER_CONNECT_RADIUS &&
        shouldInitiatePlayerVoiceOffer(
          this.localPlayerId,
          participant.player_id
        )
      ) {
        void this.makeOffer(participant.player_id);
      }
    }
  }

  private startTimers() {
    this.clearTimers();
    this.heartbeatTimer = window.setInterval(
      () => void this.sendHeartbeat(),
      PLAYER_VOICE_HEARTBEAT_MS
    );
    this.helloTimer = window.setInterval(
      () => void this.sendHello(),
      PLAYER_VOICE_HELLO_MS
    );
    this.spatialTimer = window.setInterval(
      () => this.updateSpatialAudio(),
      PLAYER_VOICE_SPATIAL_UPDATE_MS
    );
    this.schedulePoll(0);
  }

  private clearTimers() {
    for (const timer of [
      this.heartbeatTimer,
      this.helloTimer,
      this.pollTimer,
      this.spatialTimer,
      this.reconnectTimer,
    ]) {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        window.clearInterval(timer);
      }
    }
    this.heartbeatTimer = undefined;
    this.helloTimer = undefined;
    this.pollTimer = undefined;
    this.spatialTimer = undefined;
    this.reconnectTimer = undefined;
  }

  private schedulePoll(delay = PLAYER_VOICE_POLL_MS) {
    if (this.stopped) {
      return;
    }
    this.pollTimer = window.setTimeout(() => void this.pollPackets(), delay);
  }

  private async pollPackets() {
    const token = this.voiceToken;
    if (!token || this.stopped) {
      this.schedulePoll();
      return;
    }
    try {
      const raw = await playerVoiceRequest<unknown>("voicePoll", {
        voice_token: token,
        after_sequence: this.lastSequence,
      });
      const packets = voicePacketsFromResponse(raw);
      for (const packet of packets) {
        this.lastSequence = Math.max(this.lastSequence, packet.sequence);
        await this.handlePacket(packet).catch((error) => {
          log.warn("Player voice signaling packet failed", {
            error,
            packetType: packet.packet_type,
            remotePlayerId: packet.player_id,
          });
        });
      }
    } catch (error) {
      if (this.voiceToken === token) {
        this.handleRuntimeRequestFailure(error);
      }
    } finally {
      this.schedulePoll();
    }
  }

  private async sendHeartbeat() {
    const token = this.voiceToken;
    if (!token || this.stopped) {
      return;
    }
    try {
      await playerVoiceRequest("voiceHeartbeat", {
        voice_token: token,
        muted: !this.speaking,
        deafened: false,
        speaking: this.speaking,
        last_sequence: this.lastSequence,
      });
    } catch (error) {
      if (this.voiceToken === token) {
        this.handleRuntimeRequestFailure(error);
      }
    }
  }

  private handleRuntimeRequestFailure(error: unknown) {
    const status =
      error instanceof PlayerVoiceRequestError ? error.status : undefined;
    if (
      status === 401 ||
      status === 403 ||
      status === 409 ||
      status === 502 ||
      status === 504
    ) {
      this.scheduleReconnect();
      return;
    }
    log.warn("Player voice request failed", { error });
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer !== undefined) {
      return;
    }
    this.emitStatus("reconnecting");
    this.voiceToken = undefined;
    this.closeAllPeers();
    const delay = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempts++);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.joinVoiceRoom()
        .then(async () => {
          await this.sendHello();
          this.emitStatus("connected");
        })
        .catch((error) => {
          log.warn("Player voice reconnect failed", { error });
          this.scheduleReconnect();
        });
    }, delay);
  }

  private async sendHello() {
    await this.sendPacket(
      "control",
      JSON.stringify({
        version: 1,
        kind: "hello",
        from: this.localPlayerId,
      } satisfies PlayerVoiceSignalPayload)
    );
  }

  private sendPacket(packetType: VoicePacketType, payload: string) {
    const token = this.voiceToken;
    if (!token || this.stopped) {
      return Promise.resolve();
    }
    const send = () =>
      playerVoiceRequest("voicePacket", {
        voice_token: token,
        packet_type: packetType,
        payload,
      }).catch((error) => {
        if (this.voiceToken === token) {
          this.handleRuntimeRequestFailure(error);
        }
      });
    this.signalQueue = this.signalQueue.then(send, send).then(() => undefined);
    return this.signalQueue;
  }

  private async handlePacket(packet: VoicePacket) {
    if (packet.player_id === this.localPlayerId) {
      return;
    }
    const payload = parsePlayerVoiceSignalPayload(packet.payload);
    if (!payload || (payload.to && payload.to !== this.localPlayerId)) {
      return;
    }
    const remotePlayerId = packet.player_id;
    if (payload.from !== remotePlayerId) {
      return;
    }
    const distance = this.peerDistance(remotePlayerId);
    if (distance > PLAYER_VOICE_PEER_CONNECT_RADIUS) {
      return;
    }

    if (packet.packet_type === "control" && payload.kind === "hello") {
      this.ensurePeer(remotePlayerId);
      if (shouldInitiatePlayerVoiceOffer(this.localPlayerId, remotePlayerId)) {
        await this.makeOffer(remotePlayerId);
      }
      return;
    }

    const peer = this.ensurePeer(remotePlayerId);
    if (!peer) {
      return;
    }
    if (packet.packet_type === "offer" && payload.description) {
      if (peer.connection.signalingState !== "stable") {
        await peer.connection
          .setLocalDescription({ type: "rollback" })
          .catch(() => undefined);
      }
      await peer.connection.setRemoteDescription(payload.description);
      await this.flushPendingCandidates(peer);
      const answer = await peer.connection.createAnswer();
      await peer.connection.setLocalDescription(answer);
      await this.sendDescription("answer", remotePlayerId, answer);
    } else if (packet.packet_type === "answer" && payload.description) {
      await peer.connection.setRemoteDescription(payload.description);
      await this.flushPendingCandidates(peer);
    } else if (packet.packet_type === "ice" && payload.candidate) {
      if (peer.connection.remoteDescription) {
        await peer.connection.addIceCandidate(payload.candidate);
      } else {
        peer.pendingCandidates.push(payload.candidate);
      }
    }
  }

  private ensurePeer(remotePlayerId: string) {
    if (
      remotePlayerId === this.localPlayerId ||
      this.peerDistance(remotePlayerId) > PLAYER_VOICE_PEER_CONNECT_RADIUS
    ) {
      return undefined;
    }
    const existing = this.peers.get(remotePlayerId);
    if (existing) {
      return existing;
    }
    const connection = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: VoicePeer = {
      connection,
      pendingCandidates: [],
      makingOffer: false,
    };
    this.peers.set(remotePlayerId, peer);
    for (const track of this.localStream?.getTracks() ?? []) {
      connection.addTrack(track, this.localStream!);
    }
    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }
      void this.sendPacket(
        "ice",
        JSON.stringify({
          version: 1,
          from: this.localPlayerId,
          to: remotePlayerId,
          candidate: event.candidate.toJSON(),
        } satisfies PlayerVoiceSignalPayload)
      );
    };
    connection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      peer.audio?.remove();
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "true");
      audio.dataset.playerVoicePeer = remotePlayerId;
      audio.style.display = "none";
      audio.srcObject = stream;
      document.body.appendChild(audio);
      peer.audio = audio;
      this.updatePeerVolume(remotePlayerId, peer);
      void audio.play().catch(() => undefined);
    };
    connection.onconnectionstatechange = () => {
      if (
        connection.connectionState === "failed" ||
        connection.connectionState === "closed"
      ) {
        this.removePeer(remotePlayerId);
      }
      this.emitStatus(this.voiceToken ? "connected" : "reconnecting");
    };
    this.emitStatus(this.voiceToken ? "connected" : "reconnecting");
    return peer;
  }

  private async makeOffer(remotePlayerId: string) {
    const peer = this.ensurePeer(remotePlayerId);
    if (
      !peer ||
      peer.makingOffer ||
      peer.connection.signalingState !== "stable"
    ) {
      return;
    }
    peer.makingOffer = true;
    try {
      const offer = await peer.connection.createOffer();
      await peer.connection.setLocalDescription(offer);
      await this.sendDescription("offer", remotePlayerId, offer);
    } finally {
      peer.makingOffer = false;
    }
  }

  private async sendDescription(
    packetType: "offer" | "answer",
    remotePlayerId: string,
    description: RTCSessionDescriptionInit
  ) {
    await this.sendPacket(
      packetType,
      JSON.stringify({
        version: 1,
        from: this.localPlayerId,
        to: remotePlayerId,
        description: { type: description.type, sdp: description.sdp },
      } satisfies PlayerVoiceSignalPayload)
    );
  }

  private async flushPendingCandidates(peer: VoicePeer) {
    const pending = peer.pendingCandidates.splice(0);
    for (const candidate of pending) {
      await peer.connection.addIceCandidate(candidate);
    }
  }

  private peerDistance(remotePlayerId: string) {
    const remoteId = safeParseBiomesId(remotePlayerId);
    const localPosition = this.deps.resources.get(
      "/ecs/c/position",
      this.deps.userId
    )?.v;
    const remotePosition = remoteId
      ? this.deps.resources.get("/ecs/c/position", remoteId)?.v
      : undefined;
    return localPosition && remotePosition
      ? dist(localPosition, remotePosition)
      : Number.POSITIVE_INFINITY;
  }

  private updateSpatialAudio() {
    for (const [remotePlayerId, peer] of this.peers) {
      const distance = this.peerDistance(remotePlayerId);
      if (!shouldMaintainPlayerVoicePeer(distance)) {
        this.removePeer(remotePlayerId);
        continue;
      }
      this.updatePeerVolume(remotePlayerId, peer, distance);
    }
  }

  private updatePeerVolume(
    remotePlayerId: string,
    peer: VoicePeer,
    distance = this.peerDistance(remotePlayerId)
  ) {
    if (peer.audio) {
      peer.audio.volume = playerVoiceProximityVolume(
        distance,
        this.deps.getOutputVolume()
      );
    }
  }

  private removePeer(remotePlayerId: string) {
    const peer = this.peers.get(remotePlayerId);
    if (!peer) {
      return;
    }
    peer.connection.onicecandidate = null;
    peer.connection.ontrack = null;
    peer.connection.onconnectionstatechange = null;
    peer.connection.close();
    if (peer.audio) {
      peer.audio.pause();
      peer.audio.srcObject = null;
      peer.audio.remove();
    }
    this.peers.delete(remotePlayerId);
    this.emitStatus(this.voiceToken ? "connected" : "reconnecting");
  }

  private closeAllPeers() {
    for (const playerId of [...this.peers.keys()]) {
      this.removePeer(playerId);
    }
  }

  private readonly retryAudioPlayback = () => {
    for (const peer of this.peers.values()) {
      if (peer.audio?.paused) {
        void peer.audio.play().catch(() => undefined);
      }
    }
  };
}
