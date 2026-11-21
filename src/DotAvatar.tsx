import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Square, Volume2 } from 'lucide-react';
import './dot-avatar.css';

export function DotRobot({ talking = false }: { talking?: boolean }) {
  return <div className="dot-robot" data-talking={talking} aria-hidden="true">
    <i className="dot-robot-shadow" />
    <div className="dot-robot-figure">
      <div className="dot-robot-head">
        <i className="dot-robot-aerial" />
        <i className="dot-robot-ear dot-robot-ear-left" />
        <i className="dot-robot-ear dot-robot-ear-right" />
        <div className="dot-robot-shell">
          <div className="dot-robot-visor">
            <span className="dot-robot-eyes"><i /><i /></span>
            <i className="dot-robot-mouth" />
          </div>
        </div>
      </div>
      <div className="dot-robot-body">
        <i className="dot-robot-arm dot-robot-arm-left" /><i className="dot-robot-arm dot-robot-arm-right" />
        <i className="dot-robot-foot dot-robot-foot-left" /><i className="dot-robot-foot dot-robot-foot-right" />
        <div className="dot-robot-jacket"><i className="dot-robot-light" /><i className="dot-robot-speaker" /></div>
      </div>
    </div>
  </div>;
}

type Playback = 'idle' | 'waiting' | 'speaking' | 'paused';
const sampleCaption = 'สวัสดีค่ะ ดอตผู้ช่วยร้านค่ะ ถ้ามียอดซื้อพุ่ง ดอตจะบอกทันที และทุกเช้าจะบอกว่าวันนี้มีงานอะไรบ้างค่ะ';

/** The shop schedules its audible desktop alerts independently of this on-demand preview. */
export function DotAvatar({ message, desktopAction }: { message: string; desktopAction?: ReactNode }) {
  const [playback, setPlayback] = useState<Playback>('idle');
  const [caption, setCaption] = useState('');
  const [sample, setSample] = useState(false);
  const [notice, setNotice] = useState('');
  const current = useRef<SpeechSynthesisUtterance | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const preferSample = useRef(false);
  const timeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Start discovery immediately on browsers that load their voice list asynchronously.
    window.speechSynthesis?.getVoices();
    return () => {
      window.clearTimeout(timeout.current);
      const playing = audio.current;
      audio.current = null;
      playing?.pause();
      if (current.current) {
        current.current = null;
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  function stop() {
    window.clearTimeout(timeout.current);
    if (current.current) {
      current.current = null;
      window.speechSynthesis?.cancel();
    }
    const playing = audio.current;
    audio.current = null;
    playing?.pause();
    setPlayback('idle');
    setNotice('');
  }

  function playSample() {
    const track = new Audio('/dot-voice/preview.mp3');
    audio.current = track;
    setCaption(sampleCaption);
    setSample(true);
    setNotice('');
    setPlayback('waiting');
    const finish = (reason = '') => {
      if (audio.current !== track) return;
      audio.current = null;
      setPlayback('idle');
      setNotice(reason);
    };
    track.onplaying = () => { if (audio.current === track) setPlayback('speaking'); };
    track.onwaiting = () => { if (audio.current === track) setPlayback('waiting'); };
    track.onpause = () => { if (audio.current === track) setPlayback('paused'); };
    track.onended = () => finish();
    track.onerror = () => finish('โหลดตัวอย่างเสียงไม่ได้ ลองฟังอีกครั้ง');
    void track.play().catch(() => finish('กดฟังเสียง Dot อีกครั้งเพื่อเล่นตัวอย่างภาษาไทย'));
  }

  function play() {
    setNotice('');
    const synth = window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function' || preferSample.current) {
      playSample();
      return;
    }
    const voices = synth.getVoices().filter(voice => /^th(?:[-_]|$)/i.test(voice.lang));
    const thai = voices.find(voice => voice.localService) ?? voices[0];
    if (!thai) {
      playSample();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = thai.lang;
    utterance.voice = thai;
    current.current = utterance;
    setCaption(message);
    setSample(false);
    setPlayback('waiting');
    const finish = (reason = '') => {
      if (current.current !== utterance) return;
      window.clearTimeout(timeout.current);
      current.current = null;
      setPlayback('idle');
      setNotice(reason);
    };
    utterance.onstart = () => {
      if (current.current !== utterance) return;
      window.clearTimeout(timeout.current);
      setPlayback('speaking');
    };
    utterance.onpause = () => { if (current.current === utterance) setPlayback('paused'); };
    utterance.onresume = () => { if (current.current === utterance) setPlayback('speaking'); };
    utterance.onend = () => finish();
    const useSample = () => {
      if (current.current !== utterance) return;
      finish();
      preferSample.current = true;
      synth.cancel();
      playSample();
    };
    utterance.onerror = useSample;
    timeout.current = window.setTimeout(() => {
      useSample();
    }, 10000);
    try { synth.speak(utterance); }
    catch { useSample(); }
  }

  const active = playback !== 'idle';
  return <section className="dot-avatar-card" aria-label="หุ่นยนต์แจ้งเตือน Dot">
    <div className="dot-avatar-stage"><DotRobot talking={playback === 'speaking'} /></div>
    <div className="dot-avatar-copy">
      <h2>หุ่นยนต์แจ้งเตือน Dot</h2>
      <p className="dot-avatar-caption">{active && sample && <strong>ตัวอย่างเสียง Dot · </strong>}{active ? caption : message}</p>
      <div className="dot-avatar-actions">
        <button type="button" className="dot-avatar-play" onClick={active ? stop : play}>
          {active ? <Square size={15} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
          {active ? 'หยุดเสียง' : 'ฟังเสียง Dot'}
        </button>
        {desktopAction}
      </div>
      <p role="status" className="dot-avatar-notice">{notice || (playback === 'waiting' ? 'กำลังเตรียมเสียง…' : '')}</p>
    </div>
  </section>;
}
