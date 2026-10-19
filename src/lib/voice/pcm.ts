export function encodePcm(samples: Float32Array, sampleRate: number): string {
  const ratio = sampleRate / 16000;
  const output = new DataView(new ArrayBuffer(Math.floor(samples.length / ratio) * 2));
  for (let i = 0; i < output.byteLength / 2; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j] ?? 0;
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    output.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return btoa(String.fromCharCode(...new Uint8Array(output.buffer)));
}

export function decodePcm(data: string): Float32Array {
  const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  return Float32Array.from({ length: Math.floor(bytes.length / 2) }, (_, i) => view.getInt16(i * 2, true) / 32768);
}