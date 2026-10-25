// Dates are local calendar days written as 'YYYY-MM-DD'. Never UTC: after
// 8 pm in Quebec, UTC is already tomorrow.

export function todayISO(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toUtcDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

// Whole calendar days from `fromISO` to `toISO` (negative when `toISO` is earlier).
export function daysBetween(fromISO, toISO) {
  return Math.round((toUtcDay(toISO) - toUtcDay(fromISO)) / 86400000);
}
