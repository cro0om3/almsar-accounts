const SKIP_NAME = /united|arab|emirates|identity|card|nationality|resident|federal|authority|golden|comoros|sex|male|female/i;

function pad(value) {
  return String(value).padStart(2, "0");
}

function isoDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return "";
  if (y < 1950 || y > 2055) return "";
  return `${y}-${pad(m)}-${pad(d)}`;
}

function normalize(text) {
  return String(text || "")
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0))
    .replace(/[|\\]/g, "/")
    .replace(/[•·٬]/g, ".")
    .replace(/[—–]/g, "-");
}

function collectDates(text) {
  const dates = [];
  const seen = new Set();
  const add = (value) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    dates.push(value);
  };
  const source = normalize(text);
  for (const match of source.matchAll(/(\d{1,2})\D{1,3}(\d{1,2})\D{1,3}((?:19|20)\d{2})/g)) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const y = match[3];
    if (a > 12 && b <= 12) add(isoDate(y, b, a));
    else if (b > 12 && a <= 12) add(isoDate(y, a, b));
    else add(isoDate(y, b, a) || isoDate(y, a, b));
  }
  for (const match of source.matchAll(/((?:19|20)\d{2})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})/g)) {
    add(isoDate(match[1], match[2], match[3]));
  }
  return dates;
}

function formatEmiratesId(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits.includes("784")) return "";
  const start = digits.indexOf("784");
  const id = digits.slice(start, start + 15);
  if (id.length < 15 || !id.startsWith("784")) return "";
  return `${id.slice(0, 3)}-${id.slice(3, 7)}-${id.slice(7, 14)}-${id.slice(14, 15)}`;
}

function cleanName(line) {
  const text = String(line || "")
    .replace(/[^A-Za-z\u0600-\u06FF' -]+/g, " ")
    .replace(/^(name|nane|naam|nom|الاسم)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 5 || SKIP_NAME.test(text)) return "";
  const words = text.split(" ").filter((word) => word.length > 1);
  if (words.length < 2) return "";
  return words.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function nameFrom(text) {
  const labeled = text.match(/(?:name|الاسم)\s*[:./-]?\s*([A-Za-z\u0600-\u06FF' -]{5,80})/i);
  if (labeled) {
    const value = cleanName(labeled[1]);
    if (value) return value;
  }
  for (const line of text.split(/\r?\n/)) {
    const value = cleanName(line);
    if (value) return value;
  }
  return "";
}

function dateAfter(text, labels) {
  const source = normalize(text);
  const hit = source.match(new RegExp(`(?:${labels})[\\s\\S]{0,80}?(\\d{1,2}\\D{1,3}\\d{1,2}\\D{1,3}(?:19|20)\\d{2})`, "i"));
  if (!hit) return "";
  return collectDates(hit[1])[0] || "";
}

function expiryFrom(text, dates) {
  const labeled = dateAfter(text, "expir\\w*|انتهاء|صلاحية");
  if (labeled) return labeled;
  const future = dates.filter((value) => Number(value.slice(0, 4)) >= new Date().getFullYear());
  if (future.length) return future.slice().sort().at(-1);
  if (dates.length > 1) return dates.slice().sort().at(-1);
  return "";
}

export function parseEmiratesId(text) {
  const source = normalize(text);
  const idHit = source.match(/784\D{0,3}\d{4}\D{0,3}\d{7}\D{0,3}\d/);
  const dates = collectDates(source);
  const employeeId = formatEmiratesId(idHit?.[0] || source);
  const name = nameFrom(source);
  const idExpiry = expiryFrom(source, dates);
  if (!employeeId && !name && !idExpiry) return null;
  return { employeeId, name, idExpiry };
}
