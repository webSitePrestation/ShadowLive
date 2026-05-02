/** Durée de validité des liens d’invitation / partage (jours). */
const INVITE_VALIDITY_DAYS = 7;

export function accessTokenExpiresAtIso(): string {
  return new Date(
    Date.now() + INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

export function isAccessTokenExpired(expiresAt: string | null | undefined): boolean {
  if (expiresAt == null || expiresAt === '') return false;
  return new Date(expiresAt).getTime() <= Date.now();
}
