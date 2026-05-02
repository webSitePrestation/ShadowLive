export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    LIVE: '● EN DIRECT',
    PENDING: 'EN ATTENTE',
    ENDED: 'TERMINÉ',
  };
  return map[status] ?? status;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatCoins(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount.toString();
}
