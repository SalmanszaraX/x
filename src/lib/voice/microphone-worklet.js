class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(2048);
    this.cursor = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const sample of input) {
      this.samples[this.cursor++] = sample;
      if (this.cursor === this.samples.length) {
        this.port.postMessage(this.samples);
        this.samples = new Float32Array(2048);
        this.cursor = 0;
      }
    }
    return true;
  }
}
registerProcessor("zarine-microphone", MicrophoneProcessor);