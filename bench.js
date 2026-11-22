const control = document.querySelector('#detune');
const note = document.querySelector('#pitch-note');
function measure() {
  const baseHz = Number(note.value);
  const hz = baseHz * 2 ** (Number(control.value) / 1200);
  const samples = Float32Array.from({length:2048}, (_,i) => 0.5*Math.sin(2*Math.PI*i*hz/48000));
  const result = detectPitchAutocorrelation(samples, 48000, 30, 3000);
  if (!result.frequency) { document.querySelector('#reading').textContent = 'No reading for this signal.'; return; }
  const cents = 1200*Math.log2(result.frequency/baseHz);
  document.querySelector('#reading').textContent = `${Math.abs(cents) < 0.5 ? 'In tune' : cents < 0 ? 'Flat' : 'Sharp'} · ${result.frequency.toFixed(1)} Hz · ${cents.toFixed(1)} cents`;
}
control.addEventListener('input',measure);
note.addEventListener('change',measure);
measure();
control.disabled = false;
