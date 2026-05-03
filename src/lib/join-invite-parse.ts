/**
 * Extrait le token d’invitation depuis une URL complète ou une valeur brute.
 */
export function parseInviteJoinToken(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  try {
    const u = new URL(raw);
    const m = u.pathname.match(/\/join\/([^/]+)\/?$/i);
    if (m?.[1]) return decodeURIComponent(m[1].trim());
  } catch {
    /* URL relative ou invalide */
  }

  const pathMatch = raw.match(/\/join\/([^/?#\s]+)/i);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1].trim());

  const tokenOnly = raw.replace(/^\/+|\/+$/g, '').replace(/\s+/g, '');
  if (tokenOnly.length >= 8) return tokenOnly;
  return null;
}
