// Generates public/assets/sounds/chime.wav — a soft two-tone chime (~0.9s).
// 44.1 kHz, 16-bit PCM mono. The user can replace the file with any WAV/MP3
// (the overlay plays 'assets/sounds/chime.wav').
// Usage: node scripts/gen-sound.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SAMPLE_RATE = 44_100
const DURATION = 0.95
const NOTE_1_FREQ = 880 // A5
const NOTE_2_FREQ = 1318.5 // E6
const NOTE_1_DURATION = 0.18
const VOLUME = 0.45

const sampleCount = Math.floor(SAMPLE_RATE * DURATION)
const samples = new Int16Array(sampleCount)

for (let i = 0; i < sampleCount; i += 1) {
  const t = i / SAMPLE_RATE
  const note1 = t < NOTE_1_DURATION ? 1 : 0
  const note2 = t >= NOTE_1_DURATION ? 1 : 0
  // Bell-ish tone: fundamental + a quieter second harmonic.
  const tone =
    (note1 * (Math.sin(2 * Math.PI * NOTE_1_FREQ * t) + 0.35 * Math.sin(2 * Math.PI * NOTE_1_FREQ * 2 * t)) +
      note2 * (Math.sin(2 * Math.PI * NOTE_2_FREQ * (t - NOTE_1_DURATION)) + 0.3 * Math.sin(2 * Math.PI * NOTE_2_FREQ * 2 * (t - NOTE_1_DURATION)))) /
    1.35
  // Exponential decay + tiny attack to avoid clicks.
  const attack = Math.min(1, t / 0.008)
  const decay = Math.exp(-3.2 * t)
  samples[i] = Math.round(tone * attack * decay * VOLUME * 32767)
}

const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + samples.length * 2, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16) // fmt chunk size
header.writeUInt16LE(1, 20) // PCM
header.writeUInt16LE(1, 22) // mono
header.writeUInt32LE(SAMPLE_RATE, 24)
header.writeUInt32LE(SAMPLE_RATE * 2, 28) // byte rate
header.writeUInt16LE(2, 32) // block align
header.writeUInt16LE(16, 34) // bits per sample
header.write('data', 36)
header.writeUInt32LE(samples.length * 2, 40)

const dir = join('public', 'assets', 'sounds')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'chime.wav'), Buffer.concat([header, Buffer.from(samples.buffer)]))
console.log(`wrote public/assets/sounds/chime.wav (${sampleCount} samples, ${DURATION}s)`)
