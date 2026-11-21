import type { AgentAudioInputStream, AnamClient } from '@anam-ai/js-sdk';
import { z } from 'zod';
import pcmWorklet from './ready-avatar-pcm.js?url';

export type BrowserAvatarStage = 'connecting' | 'ready' | 'audio';
type Credentials = { room: string; identity: string } | { session: string };
type AudioFrame = { buffer: ArrayBuffer; peak: number };

const tokenSchema = z.object({ sessionToken: z.string().min(1) });

export function warmAvatarAudio(hosted = false) {
  if (!hosted && !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return;
  try {
    const context = new AudioContext({ sampleRate: 24000 });
    void context.resume().catch(() => {});
    return context;
  } catch {
    return undefined;
  }
}

function audioChunk(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export function createBrowserAvatar(
  video: HTMLVideoElement,
  context: AudioContext,
  notify: (stage: BrowserAvatarStage, ownsAudio: boolean) => void,
  notePlayback?: () => void,
) {
  const controller = new AbortController();
  let client: AnamClient | undefined;
  let input: AgentAudioInputStream | undefined;
  let track: MediaStreamTrack | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let worklet: AudioWorkletNode | undefined;
  let outputMeter: AudioWorkletNode | undefined;
  let connected = false;
  let ownsAudio = false;
  let acceptingAudio = true;
  let inSequence = false;
  let silentFrames = 0;
  let preroll: ArrayBuffer[] = [];

  function close() {
    if (controller.signal.aborted) return;
    controller.abort();
    connected = false;
    ownsAudio = false;
    source?.disconnect();
    worklet?.disconnect();
    if (worklet) worklet.port.onmessage = null;
    if (outputMeter) {
      outputMeter.port.onmessage = null;
      outputMeter.disconnect();
    }
    if (context.state !== 'closed') void context.close().catch(() => {});
    void client?.stopStreaming().catch(() => {});
    video.muted = true;
    video.srcObject = null;
  }

  function fail() {
    if (controller.signal.aborted) return;
    close();
    notify('audio', false);
  }

  function interrupt() {
    if (!acceptingAudio || controller.signal.aborted) return;
    acceptingAudio = false;
    preroll = [];
    try {
      if (inSequence) input?.endSequence();
      client?.interruptPersona();
    } catch {
      // Signaling can still be connecting when the first question starts.
    } finally {
      inSequence = false;
    }
  }

  function forward({ buffer, peak }: AudioFrame) {
    if (!acceptingAudio || !input || controller.signal.aborted) return;
    try {
      if (peak >= 0.007) {
        notePlayback?.();
        if (!inSequence) {
          for (const frame of preroll) input.sendAudioChunk(audioChunk(frame));
          preroll = [];
        }
        inSequence = true;
        silentFrames = 0;
      }
      if (!inSequence) {
        preroll = [...preroll.slice(-1), buffer];
        return;
      }
      input.sendAudioChunk(audioChunk(buffer));
      if (peak < 0.007 && ++silentFrames >= 6) {
        input.endSequence();
        inSequence = false;
      }
    } catch {
      fail();
    }
  }

  function attach() {
    source?.disconnect();
    source = undefined;
    if (!track || !worklet || controller.signal.aborted) return;
    try {
      source = context.createMediaStreamSource(new MediaStream([track]));
      source.connect(worklet);
    } catch {
      fail();
    }
  }

  async function enableAudio() {
    if (!connected || controller.signal.aborted) return;
    notify('ready', true);
    video.muted = false;
    try {
      await video.play();
      if (controller.signal.aborted) return;
      ownsAudio = true;
    } catch {
      if (controller.signal.aborted) return;
      video.muted = true;
      ownsAudio = false;
    }
    notify('ready', ownsAudio);
    if (context.state === 'suspended') void context.resume().catch(() => {});
  }

  async function start(credentials: Credentials) {
    notify('connecting', false);
    const timeout = window.setTimeout(fail, 45_000);
    const workletReady = context.audioWorklet.addModule(pcmWorklet).then(() => true, () => false);
    let showingVideo = false;
    try {
      const [response, sdk] = await Promise.all([
        fetch('session' in credentials ? '/api/ready/avatar' : '/api/manager/live/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials),
          signal: controller.signal,
        }),
        import('@anam-ai/js-sdk'),
      ]);
      if (!response.ok) throw Error('Anam session unavailable');
      const { sessionToken } = tokenSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      const avatar = sdk.createClient(sessionToken, { disableInputAudio: true, metrics: { disableClientMetrics: true } });
      client = avatar;
      avatar.addListener(sdk.AnamEvent.CONNECTION_CLOSED, fail);
      const firstFrame = new Promise<void>(resolve => {
        const showFrame = () => {
          if (showingVideo || controller.signal.aborted || !video.videoWidth || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          showingVideo = true;
          window.clearTimeout(timeout);
          notify('ready', false);
          resolve();
        };
        video.addEventListener('loadeddata', showFrame, { signal: controller.signal });
        avatar.addListener(sdk.AnamEvent.VIDEO_PLAY_STARTED, showFrame);
      });
      const ready = new Promise<void>(resolve => avatar.addListener(sdk.AnamEvent.SESSION_READY, () => resolve()));
      const returnedAudio = new Promise<MediaStream>(resolve => avatar.addListener(sdk.AnamEvent.AUDIO_STREAM_STARTED, resolve));
      const abandoned = new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Avatar closed')), { once: true }));

      video.id = 'ready-avatar-' + crypto.randomUUID();
      video.muted = true;
      const streaming = avatar.streamToVideoElement(video.id).then(() => {
        if (controller.signal.aborted) void avatar.stopStreaming().catch(() => {});
      });
      await Promise.race([Promise.all([firstFrame, ready, streaming]), abandoned]);
      if (controller.signal.aborted || !await workletReady) return;
      input = avatar.createAgentAudioInputStream({ encoding: 'pcm_s16le', sampleRate: 24000, channels: 1 });
      worklet = new AudioWorkletNode(context, 'ready-avatar-pcm');
      worklet.port.onmessage = event => forward(event.data);
      const silent = context.createGain();
      silent.gain.value = 0;
      worklet.connect(silent).connect(context.destination);
      attach();

      const audio = await Promise.race([returnedAudio, abandoned]);
      if (!(video.srcObject instanceof MediaStream) || controller.signal.aborted) return;
      const media = video.srcObject;
      const [audioTrack] = audio.getAudioTracks();
      if (!audioTrack) return;
      const [existing] = media.getAudioTracks();
      if (existing !== audioTrack) {
        for (const item of media.getAudioTracks()) media.removeTrack(item);
        media.addTrack(audioTrack);
      } else {
        for (const extra of media.getAudioTracks().slice(1)) media.removeTrack(extra);
      }
      outputMeter = new AudioWorkletNode(context, 'ready-avatar-pcm');
      outputMeter.port.onmessage = ({data}: MessageEvent<AudioFrame>) => {
        if (!video.muted && !video.paused && data.peak >= 0.007) notePlayback?.();
      };
      context.createMediaStreamSource(new MediaStream([audioTrack])).connect(outputMeter).connect(silent);
      if (controller.signal.aborted) return;
      connected = true;
      await enableAudio();
    } catch {
      if (!showingVideo) fail();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return {
    attachTrack(audioTrack: MediaStreamTrack) {
      track = audioTrack;
      attach();
    },
    detachTrack(audioTrack: MediaStreamTrack) {
      if (track !== audioTrack) return;
      track = undefined;
      attach();
    },
    enableAudio,
    interrupt,
    resumeAudio: () => { acceptingAudio = true; },
    start,
    close,
  };
}
