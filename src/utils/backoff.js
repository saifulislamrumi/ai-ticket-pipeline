export function calcDelay(attempt) {
  const base   = Math.pow(2, attempt) * 1000;
  const jitter = Math.random() * 500;
  return base + jitter;
}
