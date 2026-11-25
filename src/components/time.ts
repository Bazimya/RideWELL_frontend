/** RideWELL operates in Kigali: show every time in Africa/Kigali, whatever the device's zone. */
const TZ = 'Africa/Kigali';
export const fmtKigali = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) =>
  iso ? new Date(iso).toLocaleString('en-GB', { timeZone: TZ, ...opts }) : '—';
export const fmtRwf = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US'));
/** "in 12 min" / "3 min ago" */
export function relative(iso: string, now = Date.now()): string {
  const diff = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (Math.abs(diff) < 60) return diff >= 0 ? `in ${diff} min` : `${-diff} min ago`;
  const h = Math.round(diff / 60);
  return h >= 0 ? `in ${h} h` : `${-h} h ago`;
}
