# Acoustic Smart Tuner — pitch detector demo

See what 20 cents sharp looks like before trying it on an instrument. The slider generates a silent A4 waveform, and the tuner estimates its frequency from the samples. No microphone or installation is needed.

[Illustrated walkthrough](https://methos801.github.io/acoustic-smart-tuner-preview/)

Download and extract the source ZIP. Open `index.html` in Edge on Windows. Start at +20 cents (about 445 Hz), move to zero (440 Hz), then to −20 cents (about 435 Hz). With the slider focused, use the arrow keys for small adjustments.

## Inside the demo

- `bench.js` generates 2,048 samples and displays the autocorrelation detector’s estimate.
- `pitch.js` runs the detector in the browser. The TypeScript source is in `packages/audio-engine/lib/pitch.ts`.
- The separate spectrum-based detector in that file expects magnitudes in decibels. The slider uses the time-domain detector instead.

This is the pitch bench, not the native Windows microphone app. [MIT license](LICENSE).
