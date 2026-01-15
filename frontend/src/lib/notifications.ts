let active = false;

export function notifyOnce(fn: () => void) {
  if (active) return;
  active = true;
  fn();
  setTimeout(() => (active = false), 3000);
}
