const samplesPerChunk = 2400;

class ReadyAvatarPcm extends AudioWorkletProcessor {
  constructor() {
    super();
    this.allocate();
  }

  allocate() {
    this.chunk = new ArrayBuffer(samplesPerChunk * 2);
    this.view = new DataView(this.chunk);
    this.count = 0;
    this.peak = 0;
  }

  process(inputs) {
    const samples = inputs[0]?.[0];
    if (!samples) return true;
    for (const sample of samples) {
      const clamped = Math.min(1, Math.max(-1, sample));
      this.view.setInt16(this.count * 2, clamped * (clamped < 0 ? 32768 : 32767), true);
      this.peak = Math.max(this.peak, Math.abs(clamped));
      this.count++;
      if (this.count === samplesPerChunk) {
        this.port.postMessage({ buffer: this.chunk, peak: this.peak }, [this.chunk]);
        this.allocate();
      }
    }
    return true;
  }
}

registerProcessor('ready-avatar-pcm', ReadyAvatarPcm);
