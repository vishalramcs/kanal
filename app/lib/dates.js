// All date math and formatting lives here. The API sends ISO dates (YYYY-MM-DD) in the user's timezone.

export const parseISODate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const toISODate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const addDays = (iso, n) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};
export const daysBetween = (fromIso, toIso) => Math.round((parseISODate(toIso) - parseISODate(fromIso)) / 86400000);
export const startOfWeek = (iso) => {
  const d = parseISODate(iso);
  const shift = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(iso, -shift);
};

const fmt = (opts) => new Intl.DateTimeFormat(undefined, opts);
export const weekdayShort = (iso) => fmt({ weekday: "short" }).format(parseISODate(iso));
export const dayNum = (iso) => parseISODate(iso).getDate();
export const niceDate = (iso) => fmt({ weekday: "short", day: "numeric", month: "short" }).format(parseISODate(iso));
export const longDate = (iso) => fmt({ weekday: "long", day: "numeric", month: "long" }).format(parseISODate(iso));

export const fmtMinutes = (m) => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
};
export const hhmm = (mins) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
export const relDay = (today, iso) => {
  const n = daysBetween(today, iso);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : niceDate(iso);
};
export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};
export const inDays =(n) => (n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);
