/**
 * Gradient CSS déterministe à partir d’un nom (même nom → même gradient).
 */
export function generateGradient(name: string): string {
  let h1 = 0;
  let h2 = 0;
  let sSum = 0;
  let lSum = 0;
  const n = name.length || 1;
  for (let i = 0; i < name.length; i++) {
    const c = name.charCodeAt(i);
    h1 = (h1 + c * (i + 17)) % 360;
    h2 = (h2 + c * (i + 31)) % 360;
    sSum += (c % 40) + 45;
    lSum += (c % 25) + 10;
  }
  const s1 = Math.min(75, Math.round(sSum / n));
  const l1 = Math.min(22, Math.round(lSum / n));
  const s2 = Math.min(85, Math.round(((sSum * 1.3) / n) % 40) + 40);
  const l2 = Math.min(18, Math.round(((lSum * 0.9) / n) % 15) + 6);
  const hue2 = (h1 + 40 + h2) % 360;
  return `linear-gradient(135deg, hsl(${h1}, ${s1}%, ${l1}%) 0%, hsl(${hue2}, ${s2}%, ${l2}%) 100%)`;
}
