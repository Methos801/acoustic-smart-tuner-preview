/**
 * Core, platform-independent types for the Acoustic Smart Tuner audio engine.
 *
 * These types describe DSP inputs/outputs and instrument models. They contain
 * NO browser/DOM/native references so the library runs unchanged in the
 * browser, a Tauri WebView, a Capacitor WebView, and a bare Node.js process
 * (used by the Phase 1 test harness).
 */

/** Harmonic "fingerprint" weights used for coarse instrument-family matching. */
export interface HarmonicFingerprint {
  /** Probability the source is a double-reed woodwind. */
  woodwindDoubleReed: number;
  /** Clarinet-like signature (strong odd harmonics). */
  clarinetType: number;
  /** Sine-wave-like purity (flute). */
  pureFlute: number;
  /** Flat, harmonically-rich spectrum (strings/brass). */
  stringRich: number;
}

/** A tunable instrument model with physical frequency bounds and spectral cues. */
export interface Instrument {
  id: string;
  name: string;
  family: 'woodwind' | 'brass' | 'strings' | 'percussion' | 'other';
  minFreq: number; // Hz
  maxFreq: number; // Hz
  isDoubleReed?: boolean;
  standardTuning?: string[]; // e.g. ["Bb1", "F2", "C3", "G3", "D4", "A4"]
  description?: string;
  harmonicFingerprint?: HarmonicFingerprint;
}

/** Result of matching a raw frequency against a set of tuning strings. */
export interface NoteMatch {
  note: string;
  expectedFreq: number;
  centsOffset: number;
}

/** Detailed pitch decomposition for a raw frequency. */
export interface PitchDetails {
  noteName: string;
  expectedFreq: number;
  centsOffset: number;
  midi: number;
}

/** Output of a pitch-detection pass. */
export interface PitchEstimate {
  frequency: number;
  confidence: number;
}

/** Output of an instrument-fingerprint classification pass. */
export interface InstrumentMatch {
  id: string;
  confidence: number;
}
