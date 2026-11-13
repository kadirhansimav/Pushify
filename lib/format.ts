const nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
export const fmt = (n: number) => nf.format(n);

export function timeAgo(isoDate: string | null, now = Date.now()): string {
  if (!isoDate) return '';
  const s = Math.max(0, Math.round((now - new Date(isoDate).getTime()) / 1000));
  if (s < 45) return 'az önce';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.round(h / 24);
  return `${d} gün önce`;
}
