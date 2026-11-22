let context = null;

export function unlockAudio() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!context) context = new AudioContextClass();
    if (context.state === "suspended") context.resume();
  } catch {}
}

export function playMessageSound() {
  try {
    if (!context) unlockAudio();
    if (!context || context.state !== "running") return;

    const now = context.currentTime;
    [0, 0.12].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = index === 0 ? 740 : 980;
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.12, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.11);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.12);
    });
  } catch {}
}
