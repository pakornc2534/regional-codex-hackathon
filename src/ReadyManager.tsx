import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { AudioLines, Mic, MicOff, PhoneOff, Send, Volume2, X } from 'lucide-react';
import type { RemoteParticipant, Room } from 'livekit-client';
import { z } from 'zod';
import { createBrowserAvatar, warmAvatarAudio, type BrowserAvatarStage } from './ready-avatar';
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
const searchSources = z.object({
  sources: z.array(z.object({
    title: z.string().min(1).max(280),
    url: z.url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol)),
  })).max(12),
  searchedAt: z.iso.datetime().optional(),
});
type Source = z.infer<typeof searchSources>['sources'][number];
type Message =
  | { id: string; kind: 'chat'; from: 'owner' | 'manager'; text: string; final?: boolean }
  | { id: string; kind: 'sources'; sources: Source[]; searchedAt?: string };
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
const searchDate = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
type RoomCredentials = Pick<z.infer<typeof sessionSchema>, 'room' | 'identity'>;
type ActiveCall = {
  room?: Room;
  abort: AbortController;
  credentials?: RoomCredentials;
  avatarAudio?: AudioContext;
  avatar?: ReturnType<typeof createBrowserAvatar>;
};

function releaseCall(call: ActiveCall | undefined) {
  call?.abort.abort();
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

export function ReadyManager({ shopName, onOpenTextManager }: { shopName: string; onOpenTextManager: () => void }) {
  const [open, setOpen] = useState(false);
  const [call, setCall] = useState<Call>({ phase: 'idle' });
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [mic, setMic] = useState<'off' | 'on' | 'requesting'>('off');
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

  function stopCall(error?: string) {
    const current = active.current;
    active.current = undefined;
    releaseCall(current);
    playback.current?.replaceChildren();
    setCall({ phase: 'idle', error });
    setMic('off');
    setHasVideo(false);
    setAvatarMode(undefined);
    setAudioBlocked(false);
    setAvatarAudioBlocked(false);
    setBrowserAvatarStage(undefined);
    setSending(false);
  }

  function close() {
    stopCall();
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
    if (!open) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [open]);

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

  async function startCall() {
    if (active.current) return;
    const current: ActiveCall = { abort: new AbortController(), avatarAudio: warmAvatarAudio() };
    active.current = current;
    setCall({ phase: 'connecting' });
    setMessages([]);
    const timeout = window.setTimeout(() => {
      if (active.current === current) stopCall('ผู้จัดการยังไม่เข้าห้อง ลองเชื่อมต่ออีกครั้งครับ');
    }, 30000);
    current.abort.signal.addEventListener('abort', () => window.clearTimeout(timeout), { once: true });
    try {
      const response = await fetch('/api/manager/live/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: current.abort.signal,
      });
      if (response.status === 429) throw Error('กำลังมีสายสนทนาอยู่ ลองใหม่อีกครั้งในอีกสักครู่ครับ');
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
      const isCurrent = () => active.current === current;
      const isAgent = (participant: RemoteParticipant) =>
        session.assistantIdentity ? participant.identity === session.assistantIdentity : participant.kind === ParticipantKind.AGENT;

      if (session.browserAvatar && videoElement && current.avatarAudio) {
        current.avatar = createBrowserAvatar(videoElement, current.avatarAudio, (stage, ownsAudio) => {
          if (!isCurrent()) return;
          setBrowserAvatarStage(stage);
          setHasVideo(stage === 'ready');
          setAvatarAudioBlocked(stage === 'ready' && !ownsAudio);
          audioContainer?.querySelectorAll('audio').forEach(element => { element.muted = ownsAudio; });
        });
        void current.avatar.start(current.credentials);
      } else if (current.avatarAudio) {
        void current.avatarAudio.close().catch(() => {});
        current.avatarAudio = undefined;
      }

      let entered = false;
      const update = () => {
        if (!isCurrent()) return;
        if (room.state === ConnectionState.Reconnecting) {
          setCall({ phase: 'reconnecting' });
          return;
        }
        if (room.state !== ConnectionState.Connected) return;
        const assistant = Array.from(room.remoteParticipants.values()).find(isAgent);
        if (entered && !assistant) return stopCall('ผู้จัดการออกจากสายแล้ว เริ่มสายใหม่ได้ครับ');
        const ready = Boolean(assistant && readyStates.has(assistant.attributes['lk.agent.state']));
        if (ready) {
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
        .on(RoomEvent.Disconnected, () => {
          if (isCurrent()) stopCall('สายสนทนาสิ้นสุดแล้ว เริ่มสายใหม่ได้ครับ');
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
            const element = track.attach();
            element.muted = current.avatar?.ownsAudio() ?? false;
            audioContainer.append(element);
            if (isAgent(participant)) current.avatar?.attachTrack(track.mediaStreamTrack);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, track => {
          if (track.kind === Track.Kind.Video && videoElement && !current.avatar) {
            track.detach(videoElement);
            if (isCurrent()) setHasVideo(false);
          } else {
            current.avatar?.detachTrack(track.mediaStreamTrack);
            track.detach().forEach(element => element.remove());
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
        : 'เชื่อมต่อผู้จัดการสดไม่ได้ ลองใหม่อีกครั้งครับ';
      stopCall(message);
    }
  }

  async function toggleMic() {
    const current = active.current;
    if (!current?.room || mic === 'requesting' || call.phase !== 'connected' || browserAvatarStage === 'connecting') return;
    const enable = mic !== 'on';
    const room = current.room;
    setMic('requesting');
    setCall({ phase: 'connected' });
    try {
      await room.localParticipant.setMicrophoneEnabled(enable);
      if (active.current === current) setMic(enable ? 'on' : 'off');
      else if (enable) await room.localParticipant.setMicrophoneEnabled(false);
    } catch {
      if (active.current !== current) return;
      setMic(enable ? 'off' : 'on');
      setCall({ phase: 'connected', error: 'เปลี่ยนสถานะไมโครโฟนไม่ได้ ตรวจสิทธิ์ของเบราว์เซอร์หรือพิมพ์คำถามได้ครับ' });
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = active.current;
    const text = draft.trim();
    if (!text || !current?.room || sending || call.phase !== 'connected' || browserAvatarStage === 'connecting') return;
    setSending(true);
    setCall({ phase: 'connected' });
    try {
      await current.room.localParticipant.sendText(text, { topic: 'lk.chat' });
      if (active.current !== current) return;
      record({ id: crypto.randomUUID(), kind: 'chat', from: 'owner', text });
      setDraft('');
      input.current?.focus();
    } catch {
      if (active.current === current) setCall({ phase: 'connected', error: 'ส่งคำถามไม่ได้ ลองส่งใหม่ครับ' });
    } finally {
      if (active.current === current) setSending(false);
    }
  }

  const live = call.phase === 'connected' && browserAvatarStage !== 'connecting';
  const connectionLabel = browserAvatarStage === 'connecting' && call.phase === 'connected'
    ? 'กำลังเปิดวิดีโอ Anam' : statusText[call.phase];
  const inCall = call.phase !== 'idle';

  return (
    <div className="ready-manager">
      {open && <section className="ready-panel" id={panelId} aria-label="ผู้จัดการร้านพร้อม">
        <header className="ready-panel-head">
          <img src={avatar} alt="" width={37} height={37}/>
          <div><h2>พร้อม</h2><span>ผู้จัดการร้านจำลอง {shopName}</span></div>
          <button type="button" ref={closeButton} className="ready-icon" onClick={close} aria-label="ปิดผู้จัดการร้านพร้อม"><X size={20}/></button>
        </header>

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

        <div className="ready-controls">
          <span role="status" className="ready-status" data-live={live}>{connectionLabel}</span>
          {!inCall
            ? <button className="ready-primary" type="button" onClick={() => void startCall()}><AudioLines size={16}/> เริ่มคุยสด</button>
            : <>
              <button type="button" className="ready-icon" disabled={!live || mic === 'requesting'} aria-pressed={mic === 'on'} aria-label={mic === 'on' ? 'ปิดไมโครโฟน' : 'เปิดไมโครโฟน'} onClick={() => void toggleMic()}>{mic === 'on' ? <Mic size={18}/> : <MicOff size={18}/>}</button>
              <button type="button" className="ready-icon ready-end" aria-label="วางสาย" onClick={() => stopCall()}><PhoneOff size={17}/></button>
            </>}
        </div>

        <div ref={log} className="ready-messages" role="log" aria-label="ข้อความสนทนากับพร้อม" aria-live="polite">
          {!messages.length && <p className="ready-hint">ถามยอดขาย สต็อก ออเดอร์ แผนยิงแอด หรือให้พร้อมค้นข้อมูลคู่แข่งล่าสุด</p>}
          {messages.map(message => message.kind === 'chat'
            ? <div key={message.id} className={message.from === 'owner' ? 'ready-message ready-owner' : 'ready-message'}>
                <b>{message.from === 'owner' ? 'คุณ' : 'พร้อม'}</b><p>{message.text}</p>
              </div>
            : <div key={message.id} className="ready-sources">
                <b>แหล่งข้อมูลจากเว็บ</b><ul>{message.sources.map(source =>
                  <li key={source.url + source.title}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>
                )}</ul>
                {message.searchedAt && <time dateTime={message.searchedAt}>ค้นเมื่อ {searchDate.format(new Date(message.searchedAt))} เวลาไทย</time>}
              </div>)}
        </div>

        {(avatarAudioBlocked || (audioBlocked && browserAvatarStage !== 'ready')) &&
          <button type="button" className="ready-audio" onClick={() => {
            void active.current?.room?.startAudio().catch(() => setAudioBlocked(true));
            void active.current?.avatar?.enableAudio();
          }}><Volume2 size={17}/> เปิดเสียงคำตอบ</button>}
        {call.error && <div className="ready-error" role="alert">{call.error}{!inCall && <button type="button" onClick={() => { close(); onOpenTextManager(); }}>เปิดแชทข้อความเดิม</button>}</div>}
        <form className="ready-compose" onSubmit={send}>
          <label className="ready-sr" htmlFor={panelId + '-question'}>คำถามถึงพร้อม</label>
          <input ref={input} id={panelId + '-question'} value={draft} onChange={event => setDraft(event.target.value)} disabled={!live || sending} placeholder="พิมพ์คำถามถึงพร้อม" maxLength={1000}/>
          <button type="submit" className="ready-primary" aria-label="ส่งคำถามถึงพร้อม" disabled={!live || sending || !draft.trim()}><Send size={17}/></button>
        </form>
      </section>}

      <button ref={button} type="button" className="ready-launcher" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-label={open ? 'ย่อผู้จัดการร้านพร้อม' : 'เปิดผู้จัดการร้านพร้อม'} onClick={() => open ? close() : setOpen(true)}>
        <img src={avatar} alt="" width={40} height={40}/>
        <span>พร้อม<small>ผู้จัดการร้าน</small></span>
      </button>
    </div>
  );
}
