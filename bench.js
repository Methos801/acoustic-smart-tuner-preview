const control = document.querySelector('#detune');
function measure() {
  const hz = 440 * 2 ** (Number(control.value) / 1200);
  const samples = Float32Array.from({length:2048}, (_,i) => 0.5*Math.sin(2*Math.PI*i*hz/48000));
  const result = detectPitchAutocorrelation(samples, 48000, 30, 3000);
  const cents = 1200*Math.log2(result.frequency/440);
  document.querySelector('#reading').textContent = `${Math.abs(cents) < 0.5 ? 'In tune' : cents < 0 ? 'Flat' : 'Sharp'} · ${result.frequency.toFixed(1)} Hz · ${cents.toFixed(1)} cents`;
}
control.addEventListener('input',measure);
measure();
control.disabled = false;
