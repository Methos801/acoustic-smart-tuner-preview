/**
 * Fundamental pitch-detection algorithms.
 *
 * Two complementary detectors are provided:
 *   - Harmonic Product Spectrum (HPS) for frequency-domain data.
 *   - Autocorrelation for time-domain data.
 *
 * Both are pure functions over typed arrays and run identically in the browser
 * and in Node.js. Extracted verbatim from the original `src/utils/audioUtils.ts`.
 */

import { PitchEstimate } from './types';

/**
 * Harmonic Product Spectrum (HPS) pitch detection with parabolic interpolation between bins.
 * The pitch bench does not use this function.
 *
 * @param fftData Float32Array containing standard FFT log magnitudes (dB) as returned by AnalyserNode.getFloatFrequencyData
 * @param sampleRate audio sampling rate (typically 44100 or 48000)
 * @param minFreq minimum frequency to search
 * @param maxFreq maximum frequency to search
 */
export function detectPitchHPS(
  fftData: Float32Array,
  sampleRate: number,
  minFreq = 30,
  maxFreq = 2000
): PitchEstimate {
  const fftSize = fftData.length * 2;
  const binResolution = sampleRate / fftSize;

  const minBin = Math.max(1, Math.floor(minFreq / binResolution));
  const maxBin = Math.min(fftData.length - 1, Math.ceil(maxFreq / binResolution));

  // getFloatFrequencyData returns decibels; convert every bin to linear amplitude.
  const magnitudes = new Float32Array(fftData.length);
  for (let i = 0; i < fftData.length; i++) {
    const dbValue = fftData[i];
    magnitudes[i] = Math.pow(10, dbValue / 20); // convert dB to Amplitude
  }

  // HPS Algorithm
  // Number of downsampled spectrums (folded versions of the spectrum)
  const numHarmonics = 4;
  const hpsSpectrum = new Float32Array(fftData.length);

  // Copy original spectrum
  for (let i = 0; i < fftData.length; i++) {
    hpsSpectrum[i] = magnitudes[i];
  }

  // Multiply downsampled spectrums
  for (let h = 2; h <= numHarmonics; h++) {
    for (let i = minBin; i <= maxBin; i++) {
      const idx = i * h;
      if (idx < fftData.length) {
        hpsSpectrum[i] *= magnitudes[idx];
      } else {
        // Zero out or diminish to prevent artifacts beyond spectrum limit
        hpsSpectrum[i] *= 0.001;
      }
    }
  }

  // Find primary peak bin index
  let maxWeight = -1;
  let peakBin = -1;
  for (let i = minBin; i <= maxBin; i++) {
    if (hpsSpectrum[i] > maxWeight) {
      maxWeight = hpsSpectrum[i];
      peakBin = i;
    }
  }

  if (peakBin === -1 || maxWeight < 1e-35) {
    return { frequency: 0, confidence: 0 };
  }

  // Use quadratic (parabolic) interpolation around the peak bin.
  // Otherwise resolution is limited to binResolution (e.g., 44100/2048 = 21.5 Hz, which is too coarse to tune!)
  let interpolatedBin = peakBin;
  if (peakBin > 0 && peakBin < fftData.length - 1) {
    const alpha = hpsSpectrum[peakBin - 1];
    const beta = hpsSpectrum[peakBin];
    const gamma = hpsSpectrum[peakBin + 1];

    const denominator = 2 * beta - alpha - gamma;
    if (Math.abs(denominator) > 1e-9) {
      const p = 0.5 * (alpha - gamma) / denominator;
      interpolatedBin = peakBin + p;
    }
  }

  const estimatedFreq = interpolatedBin * binResolution;

  // Assess reliability / confidence based on peak height compared to background average
  let sum = 0;
  for (let i = minBin; i <= maxBin; i++) {
    sum += hpsSpectrum[i];
  }
  const avg = sum / (maxBin - minBin + 1);
  const confidence = Math.min(1.0, maxWeight / (avg * 10 || 1.0));

  return {
    frequency: estimatedFreq >= minFreq && estimatedFreq <= maxFreq ? estimatedFreq : 0,
    confidence: isNaN(confidence) ? 0 : confidence
  };
}

/**
 * Autocorrelation is the time-domain detector the pitch bench uses.
 *
 * @param waveData Time-domain float data (-1.0 to 1.0)
 * @param sampleRate audio sample rate
 * @param minFreq min frequency to check
 * @param maxFreq max frequency to check
 */
export function detectPitchAutocorrelation(
  waveData: Float32Array,
  sampleRate: number,
  minFreq = 30,
  maxFreq = 1000
): PitchEstimate {
  const signalSize = waveData.length;
  const none = { frequency: 0, confidence: 0 };
  if (signalSize < 8 || !Number.isFinite(sampleRate) || sampleRate <= 0 ||
      !Number.isFinite(minFreq) || !Number.isFinite(maxFreq) ||
      minFreq <= 0 || maxFreq <= minFreq) return none;

  // Require at least two periods in this frame. Bound work by the actual input,
  // and compute both neighbours of every searched peak (including boundaries).
  const minPeriod = Math.max(2, Math.floor(sampleRate / maxFreq));
  const maxPeriod = Math.min(Math.ceil(sampleRate / minFreq), Math.floor(signalSize / 2));
  if (minPeriod > maxPeriod) return none;

  let mean = 0;
  for (const value of waveData) {
    if (!Number.isFinite(value)) return none;
    mean += value;
  }
  mean /= signalSize;
  const centered = new Float64Array(signalSize);
  let energy = 0;
  for (let i = 0; i < signalSize; i++) {
    centered[i] = waveData[i] - mean;
    energy += centered[i] * centered[i];
  }
  if (Math.sqrt(energy / signalSize) < 0.0001) return none;

  // Normalize each lag by the energy of the SAME overlapping samples. Raw sums
  // favour short lags and bias low-register peaks in a short (2048-frame) buffer.
  const r = new Float64Array(maxPeriod + 2);
  let leftEnergy = energy;
  let rightEnergy = energy;
  for (let lag = 1; lag <= maxPeriod + 1; lag++) {
    leftEnergy -= centered[signalSize - lag] ** 2;
    rightEnergy -= centered[lag - 1] ** 2;
    if (lag < minPeriod - 1) continue;
    let cross = 0;
    for (let i = 0; i < signalSize - lag; i++) cross += centered[i] * centered[i + lag];
    const denominator = leftEnergy + rightEnergy;
    r[lag] = denominator > 0 ? 2 * cross / denominator : 0;
  }

  let strongest = 0;
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    if (r[lag] > r[lag - 1] && r[lag] >= r[lag + 1]) strongest = Math.max(strongest, r[lag]);
  }
  // A periodic signal must provide a clear peak. Prefer its first strong period
  // over near-equal peaks at multiples of that period (sub-octave errors).
  const threshold = Math.max(0.8, strongest * 0.9);
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    if (r[lag] < threshold || r[lag] <= r[lag - 1] || r[lag] < r[lag + 1]) continue;
    const alpha = r[lag - 1], beta = r[lag], gamma = r[lag + 1];
    const curvature = alpha - 2 * beta + gamma;
    const offset = Math.abs(curvature) > 1e-12 ? 0.5 * (alpha - gamma) / curvature : 0;
    const frequency = sampleRate / (lag + offset);
    if (frequency < minFreq || frequency > maxFreq) continue;
    return { frequency, confidence: Math.min(1, beta) };
  }
  return none;
}
