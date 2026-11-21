import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { History, Mic, MicOff, Minus, PhoneOff, Send, Volume2 } from 'lucide-react';
import type { RemoteParticipant, RemoteTrack, Room } from 'livekit-client';
import { z } from 'zod';
import { createReadyMicGate } from './ready-mic-gate';
import { createBrowserAvatar, warmAvatarAudio, type BrowserAvatarStage } from './ready-avatar';
import { createCloudCall, searchSources, type ReadyMessage as Message, type ShopView } from './ready-cloud';
import './ready-manager.css';

const sessionSchema = z.object({
  url: z.url().refine(value => {
    const address = new URL(value);
    return address.protocol === 'wss:' || (address.protocol === 'ws:' && ['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname));
  }),
  token: z.string().min(1),
  room: z.string().min(1),
  identity: z.string().min(1),
  assistantIdentity: z.string().optional(),
  browserAvatar: z.boolean().optional(),
});
type Call = { phase: 'idle' | 'connecting' | 'waiting' | 'connected' | 'reconnecting'; error?: string };

const statusText: Record<Call['phase'], string> = {
  idle: 'พร้อมเริ่มสนทนา',
  connecting: 'กำลังเชื่อมต่อ',
  waiting: 'กำลังรอผู้จัดการเข้าห้อง',
  connected: 'เชื่อมต่อแล้ว',
  reconnecting: 'กำลังเชื่อมต่อใหม่',
};
const avatar = '/ready-manager.webp';
const readyStates = new Set(['listening', 'thinking', 'speaking']);
const bangkokDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
type RoomCredentials = Pick<z.infer<typeof sessionSchema>, 'room' | 'identity'>;
type FirstTurn = { kind: 'text'; text: string } | { kind: 'mic' };
type ActiveCall = {
  firstTurn?: FirstTurn;
  micWanted: boolean;
  room?: Room;
  cloud?: ReturnType<typeof createCloudCall>;
  abort: AbortController;
  credentials?: RoomCredentials;
  avatarAudio?: AudioContext;
  avatar?: ReturnType<typeof createBrowserAvatar>;
  micGate?: ReturnType<typeof createReadyMicGate>;
};

function releaseCall(call: ActiveCall | undefined) {
  call?.abort.abort();
  call?.micGate?.close();
  call?.cloud?.close();
  if (call?.avatar) call.avatar.close();
  else if (call?.avatarAudio?.state !== 'closed') void call?.avatarAudio?.close().catch(() => {});
  void call?.room?.disconnect().catch(() => {});
  if (call?.credentials) {
    void fetch('/api/manager/live/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(call.credentials),
      keepalive: true,
    }).catch(() => {});
  }
}

export function ReadyManager({ shopName, shopView, hosted, snapshotSavedAt, hidden = false, onOpenTextManager }: {
  shopName: string; shopView: ShopView; hosted: boolean; snapshotSavedAt?: number | null; hidden?: boolean; onOpenTextManager: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [call, setCall] = useState<Call>({ phase: 'idle' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [mic, setMic] = useState<'off' | 'on' | 'requesting'>('off');
  const [micPaused, setMicPaused] = useState(false);
  const [micSubscribed, setMicSubscribed] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [avatarMode, setAvatarMode] = useState<'video' | 'audio'>();
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [avatarAudioBlocked, setAvatarAudioBlocked] = useState(false);
  const [browserAvatarStage, setBrowserAvatarStage] = useState<BrowserAvatarStage>();
  const active = useRef<ActiveCall | undefined>(undefined);
  const button = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const playback = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const panelId = useId();
  const view = useRef(shopView);
  useLayoutEffect(() => { view.current = shopView; }, [shopView]);

  function stopCall(error?: string) {
    const current = active.current;
    active.current = undefined;
    releaseCall(current);
    playback.current?.replaceChildren();
    setCall({ phase: 'idle', error });
    setMic('off');
    setMicPaused(false);
    setMicSubscribed(false);
    setHasVideo(false);
    setAvatarMode(undefined);
    setAudioBlocked(false);
    setAvatarAudioBlocked(false);
    setBrowserAvatarStage(undefined);
    setSending(false);
  }

  function silenceMic() {
    const current = active.current;
    if (!current) return;
    if (current.firstTurn?.kind === 'mic') current.firstTurn = undefined;
    if (!current.micWanted) return;
    current.micWanted = false;
    setMic('off');
    void current.cloud?.setMic(false).catch(() => {});
    void current.room?.localParticipant.setMicrophoneEnabled(false).catch(() => {
      if (active.current === current) stopCall();
    });
  }

  function minimize() {
    silenceMic();
    setOpen(false);
    button.current?.focus();
  }

  useEffect(() => {
    const release = () => {
      const current = active.current;
      active.current = undefined;
      releaseCall(current);
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) stopCall();
    };
    window.addEventListener('pagehide', release);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('pagehide', release);
      window.removeEventListener('pageshow', restore);
      release();
    };
  }, []);

  useEffect(() => {
    if (!open || hidden) return;
    if (window.matchMedia('(pointer: fine)').matches) input.current?.focus();
    else closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        minimize();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open, hidden]);

  useEffect(() => { if (hidden) silenceMic(); }, [hidden]);

  useEffect(() => {
    if (call.phase === 'connected' && browserAvatarStage !== 'connecting' && document.activeElement === document.body) input.current?.focus();
  }, [call.phase, browserAvatarStage]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);

  function record(message: Message) {
    setMessages(previous => {
      const existing = previous.find(item => item.id === message.id);
      if (!existing) return [...previous.slice(-79), message];
      if (existing.kind === 'chat' && message.kind === 'chat' && !existing.final) {
        return previous.map(item => item.id === message.id ? message : item);
      }
      return previous;
    });
  }

  async function startCall(firstTurn: FirstTurn) {
    if (active.current) return;
    const current: ActiveCall = { firstTurn, micWanted: false, abort: new AbortController(), avatarAudio: warmAvatarAudio(hosted) };
    active.current = current;
    setCall({ phase: 'connecting' });
    const timeout = window.setTimeout(() => {
      if (active.current === current) stopCall('ผู้จัดการยังไม่เข้าห้อง ลองเชื่อมต่ออีกครั้ง');
    }, 30000);
    current.abort.signal.addEventListener('abort', () => window.clearTimeout(timeout), { once: true });
    try {
      if (hosted) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        playback.current?.append(audio);
        const cloud = createCloudCall({
          audio, signal: current.abort.signal, view: () => view.current, record,
          connected: () => {
            window.clearTimeout(timeout);
            setMessages([]);
            setCall({ phase: 'connected' });
          },
          ended: stopCall,
          notice: error => setCall({ phase: 'connected', error }),
          micPaused: setMicPaused, audioBlocked: setAudioBlocked,
          avatar: (session, enabled) => {
            if (!enabled || !video.current || !current.avatarAudio) {
              setAvatarMode('audio');
              void current.avatarAudio?.close().catch(() => {});
              current.avatarAudio = undefined;
              return;
            }
            current.avatar = createBrowserAvatar(video.current, current.avatarAudio, (stage, ownsAudio) => {
              if (active.current !== current) return;
              setBrowserAvatarStage(stage);
              setHasVideo(stage === 'ready');
              setAvatarAudioBlocked(stage === 'ready' && !ownsAudio);
              audio.muted = ownsAudio;
              if (!ownsAudio) void cloud.playAudio();
            }, () => cloud.notePlayback());
            void current.avatar.start({ session });
          },
          track: track => current.avatar?.attachTrack(track),
        });
        current.cloud = cloud;
        await cloud.connect();
        return;
      }
      const response = await fetch('/api/manager/live/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: current.abort.signal,
      });
      if (response.status === 409) throw Error('ผู้จัดการร้านพักงานอยู่ เปิดงานและประวัติ Codex เพื่อให้ทำงานต่อ');
      if (response.status === 429) throw Error('กำลังมีสายสนทนาอยู่ ลองใหม่อีกครั้งในอีกสักครู่');
      if (!response.ok) throw Error('เปิดผู้จัดการสดไม่ได้ในสภาพแวดล้อมนี้');
      const session = sessionSchema.parse(await response.json());
      current.credentials = { room: session.room, identity: session.identity };
      if (active.current !== current) {
        releaseCall(current);
        return;
      }
      const { ConnectionState, ParticipantKind, Room, RoomEvent, Track } = await import('livekit-client');
      if (active.current !== current) return;

      const room = new Room({ adaptiveStream: true });
      const videoElement = video.current;
      const audioContainer = playback.current;
      current.room = room;
      const micGate = createReadyMicGate(paused => {
        const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
        const media = micTrack?.mediaStreamTrack;
        if (media && !micTrack.isMuted) media.enabled = current.micWanted && !paused;
        if (active.current === current) setMicPaused(paused);
      });
      current.micGate = micGate;
      const applyMicGate = () => {
        const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
        if (track && !track.isMuted) track.mediaStreamTrack.enabled = current.micWanted && !micGate.isPaused();
      };
      const isCurrent = () => active.current === current;
      const isAgent = (participant: RemoteParticipant) =>
        session.assistantIdentity ? participant.identity === session.assistantIdentity : participant.kind === ParticipantKind.AGENT;

      room.registerRpcMethod('raan.current-view', async ({ callerIdentity }) => {
        const caller = room.remoteParticipants.get(callerIdentity);
        if (!isCurrent() || !caller || !isAgent(caller)) throw Error('ห้องสนทนาไม่ตรงกัน');
        return JSON.stringify(view.current);
      });

      const fallbackAudio = new Map<RemoteTrack, HTMLMediaElement | undefined>();
      let avatarOwnsAudio = false;
      const syncFallbackAudio = () => {
        for (const [track, element] of fallbackAudio) {
          if (avatarOwnsAudio && element) {
            track.detach(element);
            element.remove();
            fallbackAudio.set(track, undefined);
          } else if (!avatarOwnsAudio && !element && audioContainer) {
            const playbackElement = track.attach();
            audioContainer.append(playbackElement);
            fallbackAudio.set(track, playbackElement);
          }
        }
      };

      if (session.browserAvatar && videoElement && current.avatarAudio) {
        current.avatar = createBrowserAvatar(videoElement, current.avatarAudio, (stage, ownsAudio) => {
          if (!isCurrent()) return;
          setBrowserAvatarStage(stage);
          setHasVideo(stage === 'ready');
          setAvatarAudioBlocked(stage === 'ready' && !ownsAudio);
          avatarOwnsAudio = ownsAudio;
          syncFallbackAudio();
        }, () => micGate.audio());
        void current.avatar.start(current.credentials);
      } else if (current.avatarAudio) {
        void current.avatarAudio.close().catch(() => {});
        current.avatarAudio = undefined;
      }

      let entered = false;
      const update = () => {
        if (!isCurrent()) return;
        if (room.state === ConnectionState.Reconnecting) {
          micGate.agentBusy(true);
          setCall({ phase: 'reconnecting' });
          return;
        }
        if (room.state !== ConnectionState.Connected) return;
        const assistant = Array.from(room.remoteParticipants.values()).find(isAgent);
        if (entered && !assistant) return stopCall('ผู้จัดการออกจากสายแล้ว เริ่มสายใหม่ได้');
        const assistantState = assistant?.attributes['lk.agent.state'];
        micGate.agentBusy(assistantState === 'thinking' || assistantState === 'speaking');
        const ready = Boolean(assistantState && readyStates.has(assistantState));
        if (ready && !entered) {
          setMessages([]);
          entered = true;
          window.clearTimeout(timeout);
        }
        setCall({ phase: ready ? 'connected' : 'waiting' });
      };

      room
        .on(RoomEvent.ConnectionStateChanged, update)
        .on(RoomEvent.ParticipantConnected, update)
        .on(RoomEvent.ParticipantDisconnected, update)
        .on(RoomEvent.ParticipantAttributesChanged, update)
        .on(RoomEvent.LocalTrackPublished, applyMicGate)
        .on(RoomEvent.LocalTrackSubscribed, publication => {
          if (isCurrent() && publication.source === Track.Source.Microphone) setMicSubscribed(true);
        })
        .on(RoomEvent.LocalTrackUnpublished, publication => {
          if (isCurrent() && publication.source === Track.Source.Microphone) setMicSubscribed(false);
        })
        .on(RoomEvent.TrackUnmuted, applyMicGate)
        .on(RoomEvent.Disconnected, () => {
          if (isCurrent()) stopCall('สายสนทนาสิ้นสุดแล้ว เริ่มสายใหม่ได้');
        })
        .on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (isCurrent()) setAudioBlocked(!room.canPlaybackAudio);
        })
        .on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          if (!isCurrent()) return;
          if (track.kind === Track.Kind.Video && videoElement && !current.avatar) {
            track.attach(videoElement);
            setHasVideo(true);
          } else if (track.kind === Track.Kind.Audio && audioContainer) {
            if (!fallbackAudio.has(track)) fallbackAudio.set(track, undefined);
            syncFallbackAudio();
            if (isAgent(participant)) current.avatar?.attachTrack(track.mediaStreamTrack);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, track => {
          if (track.kind === Track.Kind.Video && videoElement && !current.avatar) {
            track.detach(videoElement);
            if (isCurrent()) setHasVideo(false);
          } else {
            current.avatar?.detachTrack(track.mediaStreamTrack);
            const element = fallbackAudio.get(track);
            if (element) {
              track.detach(element);
              element.remove();
            }
            fallbackAudio.delete(track);
          }
        });

      room.registerTextStreamHandler('lk.transcription', async (reader, sender) => {
        const attributes = reader.info.attributes;
        try {
          const text = (await reader.readAll()).trim();
          if (!text || !isCurrent()) return;
          const participant = room.remoteParticipants.get(sender.identity);
          const fromAgent = participant && isAgent(participant);
          const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone);
          const owner = sender.identity === session.identity
            || Boolean(micTrack && attributes?.['lk.transcribed_track_id'] === micTrack.trackSid);
          if (!owner && !fromAgent) return;
          // Realtime deltas accumulate in one stream. LiveKit may close it without publishing a separate final stream.
          const final = attributes?.['lk.transcription_final'] !== 'false';
          const id = sender.identity + ':' + (attributes?.['lk.segment_id'] || reader.info.id);
          record({ id, kind: 'chat', from: owner ? 'owner' : 'manager', text, final });
        } catch {
          // Ignore an interrupted stream. Previously completed messages remain visible.
        }
      });

      room.registerTextStreamHandler('raan.sources', async (reader, sender) => {
        try {
          const payload = searchSources.parse(JSON.parse(await reader.readAll()));
          const participant = room.remoteParticipants.get(sender.identity);
          if (isCurrent() && participant && isAgent(participant) && payload.sources.length) {
            record({ id: reader.info.id, kind: 'sources', sources: payload.sources, searchedAt: payload.searchedAt });
          }
        } catch {
          // A malformed or interrupted source stream cannot create links in the chat.
        }
      });

      room.registerTextStreamHandler('raan.avatar-status', async (reader, sender) => {
        try {
          const payload = z.object({ mode: z.enum(['video', 'audio']) }).parse(JSON.parse(await reader.readAll()));
          const participant = room.remoteParticipants.get(sender.identity);
          if (isCurrent() && participant && isAgent(participant)) setAvatarMode(payload.mode);
        } catch {
          // The photo remains visible until the avatar video track is available.
        }
      });

      await room.connect(session.url, session.token);
      if (!isCurrent()) {
        await room.disconnect();
        return;
      }
      if (room.localParticipant.identity !== session.identity) {
        stopCall('ข้อมูลของห้องสนทนาไม่ตรงกัน กรุณาเริ่มใหม่');
        return;
      }
      update();
      setAudioBlocked(!room.canPlaybackAudio);
    } catch (error) {
      if (active.current !== current) return;
      const message = error instanceof Error && /[\u0E00-\u0E7F]/.test(error.message)
        ? error.message
        : 'เชื่อมต่อผู้จัดการสดไม่ได้ ลองใหม่อีกครั้ง';
      stopCall(message);
    }
  }

  async function toggleMic() {
    if (!active.current) { void startCall({ kind: 'mic' }); return; }
    if (mic === 'requesting' || call.phase !== 'connected') return;
    await changeMic(active.current, mic !== 'on');
  }

  async function changeMic(current: ActiveCall, enable: boolean) {
    if (!current.cloud && !current.room) return;
    current.micWanted = enable;
    const room = current.room;
    setMic('requesting');
    setCall({ phase: 'connected' });
    try {
      if (current.cloud) {
        await current.cloud.setMic(enable);
        if (active.current === current && current.micWanted === enable) {
          setMic(enable ? 'on' : 'off');
          setMicSubscribed(enable);
        }
        return;
      }
      if (!room) return;
      const publication = await room.localParticipant.setMicrophoneEnabled(enable, {
        echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      });
      if (enable && (active.current !== current || !current.micWanted)) {
        await room.localParticipant.setMicrophoneEnabled(false);
        return;
      }
      if (active.current === current) {
        if (enable && current.micGate?.isPaused() && publication?.track) publication.track.mediaStreamTrack.enabled = false;
        setMic(enable ? 'on' : 'off');
      }
    } catch {
      if (active.current !== current) return;
      current.micWanted = !enable;
      setMic(enable ? 'off' : 'on');
      setCall({ phase: 'connected', error: 'เปลี่ยนสถานะไมโครโฟนไม่ได้ ตรวจสิทธิ์ของเบราว์เซอร์หรือพิมพ์คำถามได้' });
    }
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = active.current;
    const text = draft.trim();
    if (!text || sending) return;
    if (!current) { void startCall({ kind: 'text', text }); return; }
    if (live) void sendText(current, text);
  }

  async function sendText(current: ActiveCall, text: string) {
    if (!current.room && !current.cloud) return;
    setSending(true);
    setCall({ phase: 'connected' });
    try {
      current.micGate?.audio();
      if (current.cloud) current.cloud.sendText(text);
      else await current.room?.localParticipant.sendText(text, { topic: 'lk.chat' });
      if (active.current !== current) return;
      record({ id: crypto.randomUUID(), kind: 'chat', from: 'owner', text });
      setDraft(value => value.trim() === text ? '' : value);
      if (input.current?.offsetWidth) input.current.focus();
    } catch {
      if (active.current === current) setCall({ phase: 'connected', error: 'ส่งคำถามไม่ได้ ลองส่งใหม่' });
    } finally {
      if (active.current === current) setSending(false);
    }
  }

  const live = call.phase === 'connected' && browserAvatarStage !== 'connecting';
  useEffect(() => {
    const current = active.current;
    if (!live || !current?.firstTurn) return;
    const first = current.firstTurn;
    current.firstTurn = undefined;
    if (first.kind === 'text') void sendText(current, first.text);
    else if (open && !hidden) void changeMic(current, true);
  }, [live, open, hidden]);

  const canSubmit = live || call.phase === 'idle';
  let connectionLabel = statusText[call.phase];
  if (call.phase === 'idle' && messages.length) connectionLabel = 'จบการสนทนาแล้ว';
  else if (call.phase === 'connected' && !live) connectionLabel = 'กำลังเตรียมเสียง';
  else if (live && (mic === 'requesting' || (mic === 'on' && !micSubscribed))) connectionLabel = 'กำลังเปิดไมค์';
  else if (live && mic === 'on') connectionLabel = micPaused ? 'พักไมค์ขณะพร้อมตอบ' : 'ไมค์เปิดอยู่';
  const inCall = call.phase !== 'idle';

  return (
    <div className="ready-manager" hidden={hidden} inert={hidden}>
      <section className="ready-panel" hidden={!open} id={panelId} aria-label="ผู้จัดการร้านพร้อม">
        <header className="ready-panel-head">
          <div><h2>พร้อม</h2><span>ผู้จัดการร้านจำลอง {shopName}</span></div>
          <button type="button" className="ready-icon ready-history" onClick={onOpenTextManager} aria-label="งานและประวัติ Codex" title="งานและประวัติ Codex"><History size={18}/></button>
          <button type="button" ref={closeButton} className="ready-icon" onClick={minimize} aria-label="ย่อแชทพร้อม" title="ย่อแชท"><Minus size={18}/></button>
        </header>

        {snapshotSavedAt != null && <p className="ready-snapshot">ข้อมูลร้านบันทึกล่าสุด <time dateTime={new Date(snapshotSavedAt).toISOString()}>{bangkokDate.format(snapshotSavedAt)} น. เวลาไทย</time></p>}
        <div className="ready-stage">
          <img src={avatar} alt="ภาพผู้จัดการร้านพร้อม" width={480} height={320} hidden={hasVideo}/>
          <video ref={video} autoPlay playsInline hidden={!hasVideo && browserAvatarStage !== 'connecting'} aria-label="วิดีโอสดของพร้อม"
            data-avatar-loading={browserAvatarStage === 'connecting' ? true : undefined}
            data-avatar-source={browserAvatarStage === 'ready' ? 'anam-browser' : undefined}/>
          <div ref={playback} hidden aria-hidden="true"/>
          {browserAvatarStage === 'connecting' && <span className="ready-voice-label">กำลังเปิดวิดีโอ Anam</span>}
          {!hasVideo && browserAvatarStage !== 'connecting' && (avatarMode === 'audio' || browserAvatarStage === 'audio') &&
            <span className="ready-voice-label">โหมดเสียง</span>}
        </div>

        {(inCall || messages.length > 0) && <div className="ready-controls">
          <span role="status" className="ready-status" data-live={live} data-mic-paused={mic === 'on' && micPaused}>
            {connectionLabel}
          </span>
          {inCall && <button type="button" className="ready-end" aria-label="วางสาย" onClick={() => stopCall()}><PhoneOff size={15}/> วางสาย</button>}
        </div>}

        <div ref={log} className="ready-messages" role="log" aria-label="ข้อความสนทนากับพร้อม" aria-live="polite">
          {!messages.length && <p className="ready-hint">พิมพ์ถามเรื่องร้าน หรือกดไมค์เพื่อคุยกับพร้อม</p>}
          {messages.map(message => message.kind === 'chat'
            ? <div key={message.id} className={message.from === 'owner' ? 'ready-message ready-owner' : 'ready-message'}>
                <b>{message.from === 'owner' ? 'คุณ' : 'พร้อม'}</b><p>{message.text}</p>
              </div>
            : <div key={message.id} className="ready-sources">
                <b>แหล่งข้อมูลจากเว็บ</b><ul>{message.sources.map(source =>
                  <li key={source.url + source.title}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>
                )}</ul>
                {message.searchedAt && <time dateTime={message.searchedAt}>ค้นเมื่อ {bangkokDate.format(new Date(message.searchedAt))} เวลาไทย</time>}
              </div>)}
        </div>

        {(avatarAudioBlocked || (audioBlocked && browserAvatarStage !== 'ready')) &&
          <button type="button" className="ready-audio" onClick={() => {
            void active.current?.room?.startAudio().catch(() => setAudioBlocked(true));
            void active.current?.cloud?.playAudio();
            void active.current?.avatar?.enableAudio();
          }}><Volume2 size={17}/> เปิดเสียงคำตอบ</button>}
        {call.error && <div className="ready-error" role="alert">{call.error}</div>}
        <form className="ready-compose" onSubmit={send}>
          <label className="ready-sr" htmlFor={panelId + '-question'}>คำถามถึงพร้อม</label>
          <input ref={input} id={panelId + '-question'} value={draft} onChange={event => setDraft(event.target.value)} placeholder={!inCall && messages.length ? 'เริ่มบทสนทนาใหม่…' : 'พิมพ์คำถามถึงพร้อม'} maxLength={1000}/>
          <button type="button" className="ready-icon ready-mic" disabled={!canSubmit || mic === 'requesting'} aria-pressed={mic === 'on'} aria-label={mic === 'on' ? 'ปิดไมโครโฟน' : 'เปิดไมโครโฟน'} title={mic === 'on' ? 'ปิดไมโครโฟน' : 'เปิดไมโครโฟน'} onClick={() => void toggleMic()}>{mic === 'on' && micPaused ? <MicOff size={18}/> : <Mic size={18}/>}</button>
          <button type="submit" className="ready-primary" aria-label="ส่งคำถามถึงพร้อม" disabled={!canSubmit || sending || !draft.trim()}><Send size={17}/></button>
        </form>
      </section>

      <button ref={button} type="button" className="ready-launcher" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={open ? 'ย่อผู้จัดการร้านพร้อม' : 'เปิดผู้จัดการร้านพร้อม'} onClick={() => open ? minimize() : setOpen(true)}>
        <img src={avatar} alt="" width={40} height={40}/>
        <span>พร้อม<small>{inCall ? 'อยู่ในสาย' : 'ผู้จัดการร้าน'}</small></span>
      </button>
    </div>
  );
}
