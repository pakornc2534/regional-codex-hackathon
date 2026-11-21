import { z } from 'zod';
import { createReadyMicGate } from './ready-mic-gate';
import type { Page } from './workspaces';
import type { PlanInputs } from './model';

export type ShopView = { page: Page; selectedVariantId?: string; plan?: PlanInputs; conversationId?: string };
export const searchSources = z.object({
  sources: z.array(z.object({
    title: z.string().min(1).max(280),
    url: z.url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol)),
  })).max(12),
  searchedAt: z.iso.datetime().optional(),
});
export type ReadyMessage =
  | { id: string; kind: 'chat'; from: 'owner' | 'manager'; text: string; final?: boolean }
  | { id: string; kind: 'sources'; sources: z.infer<typeof searchSources>['sources']; searchedAt?: string };

const sessionSchema = z.object({ sdp: z.string().min(1), session: z.string().min(1), avatar: z.boolean(), expiresAt: z.number().positive() });
const apiError = z.object({ error: z.string().min(1).max(300) });
const toolResult = searchSources.partial().extend({ result: z.unknown() });
const toolCall = z.object({ type: z.literal('function_call'), name: z.string(), arguments: z.string(), call_id: z.string() });
const eventHeader = z.object({ type: z.string() });
const doneResponse = z.object({ response: z.object({ status: z.string(), output: z.array(z.unknown()) }) });
const item = z.object({ item_id: z.string() });
const transcription = item.extend({ transcript: z.string() });
const textPart = item.extend({ text: z.string() });
const deltaPart = item.extend({ delta: z.string() });
const objectArgs = z.record(z.string(), z.unknown());

type CloudOptions = {
  audio: HTMLAudioElement;
  signal: AbortSignal;
  view: () => ShopView;
  record: (message: ReadyMessage) => void;
  connected: () => void;
  ended: (message: string) => void;
  notice: (message: string) => void;
  micPaused: (paused: boolean) => void;
  audioBlocked: (blocked: boolean) => void;
  avatar: (session: string, enabled: boolean) => void;
  track: (track: MediaStreamTrack) => void;
};

export function createCloudCall(options: CloudOptions) {
  const peer = new RTCPeerConnection();
  const sender = peer.addTransceiver('audio', { direction: 'sendrecv' }).sender;
  const events = peer.createDataChannel('oai-events');
  const questions: { id: string; text: string }[] = [];
  const queued: string[] = [];
  const partials = new Map<string, string>();
  let session: string | undefined;
  let mic: MediaStreamTrack | undefined;
  let wanted = false;
  let micGeneration = 0;
  let capturing = false;
  let responding = false;
  let playing = false;
  let closed = false;
  let leaseTimer: number | undefined;
  let pendingTranscription: { id: string; ready: Promise<void>; finish: () => void } | undefined;
  const gate = createReadyMicGate(paused => {
    if (mic) mic.enabled = wanted && !paused;
    options.micPaused(paused);
  });

  function endRemote(id: string) {
    void fetch('/api/ready/end', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: id }), keepalive: true,
    }).catch(() => {});
  }

  function close() {
    if (closed) return;
    closed = true;
    options.signal.removeEventListener('abort', close);
    window.clearTimeout(leaseTimer);
    pendingTranscription?.finish();
    gate.close();
    mic?.stop();
    events.close();
    peer.close();
    options.audio.pause();
    options.audio.srcObject = null;
    if (session) endRemote(session);
  }
  options.signal.addEventListener('abort', close, { once: true });

  function remember(id: string, text: string) {
    if (questions.some(row => row.id === id)) return;
    questions.push({ id, text });
    if (questions.length > 5) questions.shift();
  }
  function send(event: object) { events.send(JSON.stringify(event)); }
  function requestResponse() {
    responding = true;
    gate.agentBusy(true);
    send({ type: 'response.create' });
  }
  function flushText() {
    if (closed || capturing || responding || playing || events.readyState !== 'open') return;
    const text = queued.shift();
    if (!text) return;
    pendingTranscription?.finish();
    pendingTranscription = undefined;
    const id = crypto.randomUUID().replaceAll('-', '').slice(0, 24);
    send({ type: 'conversation.item.create', item: { id, type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });
    remember(id, text);
    requestResponse();
  }
  function sendText(text: string) {
    if (closed || events.readyState !== 'open') throw Error('สายสิ้นสุดแล้ว');
    queued.push(text);
    flushText();
  }

  async function setMic(enable: boolean) {
    wanted = enable;
    const generation = ++micGeneration;
    if (!enable) {
      mic?.stop();
      mic = undefined;
      await sender.replaceTrack(null);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const [track] = stream.getAudioTracks();
    if (!track) throw Error('ไม่พบไมโครโฟน');
    if (closed || generation !== micGeneration) { track.stop(); return; }
    track.enabled = !gate.isPaused();
    mic = track;
    try { await sender.replaceTrack(track); }
    catch (error) { track.stop(); if (mic === track) mic = undefined; throw error; }
  }

  async function playAudio() {
    if (!options.audio.srcObject || options.audio.muted || closed) return;
    try { await options.audio.play(); if (!closed) options.audioBlocked(false); }
    catch { if (!closed && !options.audio.muted) options.audioBlocked(true); }
  }

  peer.ontrack = ({ track }) => {
    if (closed || track.kind !== 'audio') return;
    options.audio.srcObject = new MediaStream([track]);
    options.track(track);
    void playAudio();
  };
  peer.onconnectionstatechange = () => {
    if (!closed && peer.connectionState === 'failed') options.ended('การเชื่อมต่อสายขัดข้อง กรุณาเริ่มสนทนาใหม่');
  };
  events.onopen = () => { if (!closed) options.connected(); };
  events.onclose = () => { if (!closed) options.ended('สายสนทนาสิ้นสุดแล้ว เริ่มสายใหม่ได้'); };

  function expectTranscript(id: string) {
    pendingTranscription?.finish();
    let finish = () => {};
    const ready = new Promise<void>(resolve => { finish = resolve; });
    pendingTranscription = { id, ready, finish };
  }

  async function execute(tool: z.infer<typeof toolCall>) {
    try {
      const speech = pendingTranscription;
      if (speech) {
        // Input transcription is asynchronous and sometimes arrives after the model's tool call.
        const timer = window.setTimeout(speech.finish, 7000);
        try { await speech.ready; } finally { window.clearTimeout(timer); }
        if (!questions.some(row => row.id === speech.id)) throw Error('ยังได้รับข้อความถอดเสียงไม่ครบ กรุณาถามซ้ำหรือพิมพ์คำถาม');
      }
      const response = await fetch('/api/ready/tool', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: options.signal,
        body: JSON.stringify({ session, name: tool.name, arguments: objectArgs.parse(JSON.parse(tool.arguments)),
          view: options.view(), questions: questions.map(row => row.text) }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw Error(apiError.safeParse(body).data?.error || 'ยังอ่านข้อมูลไม่ได้');
      const { result, sources, searchedAt } = toolResult.parse(body);
      if (sources?.length && !closed) options.record({ kind: 'sources', id: tool.call_id, sources, searchedAt });
      return result;
    } catch (error) {
      return { error: error instanceof Error && /[ก-๙]/.test(error.message) ? error.message : 'เครื่องมือยังตอบไม่ได้ กรุณาลองใหม่อีกครั้ง' };
    }
  }

  async function finishResponse(raw: unknown) {
    const { response } = doneResponse.parse(raw);
    const calls = response.status === 'completed' ? response.output.flatMap(output => {
      const valid = toolCall.safeParse(output);
      return valid.success ? [valid.data] : [];
    }) : [];
    if (calls.length) {
      const results = await Promise.all(calls.map(execute));
      if (closed || events.readyState !== 'open') return;
      calls.forEach((call, index) => send({ type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(results[index]) } }));
      requestResponse();
      return;
    }
    responding = false;
    gate.agentBusy(playing);
    if (response.status === 'failed') options.notice('ผู้จัดการตอบไม่สำเร็จ ลองส่งคำถามอีกครั้ง');
    flushText();
  }

  function receive(raw: unknown) {
    const { type } = eventHeader.parse(raw);
    switch (type) {
      case 'input_audio_buffer.speech_started': capturing = true; break;
      case 'input_audio_buffer.cleared': capturing = false; flushText(); break;
      case 'input_audio_buffer.committed': {
        capturing = false;
        const { item_id } = item.parse(raw);
        expectTranscript(item_id);
        options.record({ id: item_id, kind: 'chat', from: 'owner', text: 'กำลังถอดเสียง…', final: false });
        responding = true;
        gate.agentBusy(true);
        break;
      }
      case 'conversation.item.input_audio_transcription.completed': {
        const { item_id, transcript } = transcription.parse(raw);
        const text = transcript.trim();
        if (text) remember(item_id, text);
        options.record({ id: item_id, kind: 'chat', from: 'owner', text: text || 'ไม่ได้ยินคำถาม', final: true });
        if (pendingTranscription?.id === item_id) pendingTranscription.finish();
        break;
      }
      case 'conversation.item.input_audio_transcription.failed': {
        const { item_id } = item.parse(raw);
        if (pendingTranscription?.id === item_id) pendingTranscription.finish();
        options.record({ id: item_id, kind: 'chat', from: 'owner', text: 'ถอดเสียงไม่สำเร็จ', final: true });
        break;
      }
      case 'response.created': responding = true; gate.agentBusy(true); break;
      case 'output_audio_buffer.started': playing = true; gate.agentBusy(true); break;
      case 'output_audio_buffer.cleared':
      case 'output_audio_buffer.stopped': playing = false; gate.agentBusy(responding); flushText(); break;
      case 'response.output_audio_transcript.delta':
      case 'response.output_text.delta': {
        const { item_id, delta } = deltaPart.parse(raw);
        const text = (partials.get(item_id) || '') + delta;
        partials.set(item_id, text);
        options.record({ id: item_id, kind: 'chat', from: 'manager', text, final: false });
        break;
      }
      case 'response.output_audio_transcript.done':
      case 'response.output_text.done': {
        const { item_id } = item.parse(raw);
        const text = type === 'response.output_text.done' ? textPart.parse(raw).text : transcription.parse(raw).transcript;
        partials.delete(item_id);
        if (text.trim()) options.record({ id: item_id, kind: 'chat', from: 'manager', text, final: true });
        break;
      }
      case 'response.done': void finishResponse(raw).catch(() => { if (!closed) options.ended('สายสนทนาขัดข้อง กรุณาเริ่มใหม่'); }); break;
      case 'error': options.notice('ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง'); break;
    }
  }
  events.onmessage = event => {
    if (closed || typeof event.data !== 'string') return;
    try { receive(JSON.parse(event.data)); } catch { /* Ignore unsupported event payloads. */ }
  };

  async function connect() {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    if (closed) return;
    const response = await fetch('/api/ready/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      // A hang-up during signaling still needs the returned session ID to release the server slot.
      body: JSON.stringify({ sdp: offer.sdp }), signal: AbortSignal.timeout(30_000),
    });
    const raw: unknown = await response.json();
    if (!response.ok) throw Error(apiError.safeParse(raw).data?.error || 'เปิดการคุยกับพร้อมไม่ได้ กรุณาลองอีกครั้ง');
    const data = sessionSchema.parse(raw);
    session = data.session;
    if (closed) { endRemote(session); return; }
    const serverTime = Date.parse(response.headers.get('date') || '');
    const remaining = data.expiresAt - (Number.isFinite(serverTime) ? serverTime : Date.now());
    leaseTimer = window.setTimeout(() => options.ended('ครบเวลาของสายเดโมแล้ว เริ่มสนทนาใหม่ได้'), Math.max(0, remaining));
    options.avatar(session, data.avatar);
    await peer.setRemoteDescription({ type: 'answer', sdp: data.sdp });
  }

  return { connect, setMic, sendText, playAudio, close, notePlayback: () => gate.audio() };
}
