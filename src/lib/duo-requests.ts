/** Erreur PostgREST quand la table `duo_requests` n’existe pas ou n’est pas exposée. */
export function isDuoRequestsTableUnavailable(err: {
  message?: string;
  code?: string;
} | null | undefined): boolean {
  if (!err) return false;
  const m = (err.message ?? '').toLowerCase();
  const c = err.code ?? '';
  return (
    c === 'PGRST205' ||
    c === '42P01' ||
    m.includes('duo_requests') ||
    m.includes('schema cache') ||
    m.includes('does not exist')
  );
}
