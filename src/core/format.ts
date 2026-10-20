const UNITS = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag', 'ah'] as const;

/** 1234567 -> "1.23M" */
export function formatNumber(value: number, decimals = 2): string {
  if (!isFinite(value)) return '0';
  const sign = value < 0 ? '-' : '';
  let n = Math.abs(value);
  if (n < 1000) {
    if (n === 0) return '0';
    if (n < 10 && decimals > 0) return sign + trimZeros(n.toFixed(decimals));
    return sign + Math.floor(n).toString();
  }
  let tier = 0;
  while (n >= 1000 && tier < UNITS.length - 1) {
    n /= 1000;
    tier++;
  }
  return sign + trimZeros(n.toFixed(n < 10 ? decimals : 1));
}

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** 3725 -> "1h 2m" */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0s';
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

/** Short duration used inside the HUD, e.g. "04:12". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatPercent(fraction: number, decimals = 1): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

export function formatSigned(value: number, decimals = 0): string {
  const text = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  return value >= 0 ? `+${text}` : text;
}

/** Time-of-day greeting for the hub header. */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'The pit never sleeps';
  if (h < 12) return 'Good morning, champion';
  if (h < 18) return 'Good day, champion';
  return 'Good evening, champion';
}

/** ISO-ish day key (UTC) used for the login bonus streak. */
export function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function dayDiff(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.round((tb - ta) / 86400000);
}
