function pad(value) {
  return String(value).padStart(2, "0");
}

export function displayFromIso(value) {
  const text = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const [year, month, day] = text.split("-");
  return `${day}/${month}/${year}`;
}

export function daysUntil(value) {
  const text = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

export function isoFromDisplay(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const hit = text.match(/^(\d{1,2})[/.\\-](\d{1,2})[/.\\-](\d{2,4})$/);
  if (!hit) return "";
  const day = Number(hit[1]);
  const month = Number(hit[2]);
  let year = hit[3];
  if (year.length === 2) year = Number(year) >= 70 ? `19${year}` : `20${year}`;
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}-${pad(month)}-${pad(day)}`;
}
