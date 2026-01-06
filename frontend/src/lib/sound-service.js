// Sound service for notification sounds

let isMuted = false;

const playSound = () => {
  if (isMuted) return;
  // Simple beep sound
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.type = 'sine';
  oscillator.frequency.value = 800;
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
};

const toggleMute = () => {
  isMuted = !isMuted;
  return isMuted;
};

const isMutedStatus = () => {
  return isMuted;
};

export default {
  playSound,
  toggleMute,
  isMutedStatus,
};
