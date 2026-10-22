const SKIP_NAME = /united|arab|emirat|identity|card|nationality|resident|federal|authority|golden|comoros|sex|male|female|issuing|suing|expiry|occupation|birth|place|security|date|number|idare|ilare|earns/i;

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

function idYear(id) {
  const year = Number(String(id || "").replace(/\D/g, "").slice(3, 7));
  const latest = new Date().getFullYear() + 1;
  return year >= 1940 && year <= latest ? String(year) : "";
}

function collectEmiratesIds(text) {
  const found = [];
  const seen = new Set();
  const add = (raw) => {
    const id = formatEmiratesId(raw);
    if (!id || !idYear(id) || seen.has(id)) return;
    seen.add(id);
    found.push(id);
  };
  const source = normalize(text);
  for (const match of source.matchAll(/784\D{0,3}\d{4}\D{0,3}\d{7}\D{0,3}\d/g)) add(match[0]);
  for (const match of source.matchAll(/784\d{0,1}((?:19|20)\d{2})(\d{7})(\d)/g)) {
    add(`784${match[1]}${match[2]}${match[3]}`);
  }
  const digits = source.replace(/\D/g, "");
  for (let i = 0; i <= digits.length - 15; i += 1) {
    if (digits.slice(i, i + 3) === "784") add(digits.slice(i, i + 15));
  }
  return found;
}

function icaoCheck(value) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    let n = 0;
    if (ch >= "0" && ch <= "9") n = Number(ch);
    else if (ch >= "A" && ch <= "Z") n = ch.charCodeAt(0) - 55;
    sum += n * weights[i % 3];
  }
  return String(sum % 10);
}

function mrzDate(raw) {
  const value = String(raw || "").replace(/\D/g, "");
  if (value.length < 6) return "";
  const yy = Number(value.slice(0, 2));
  const month = value.slice(2, 4);
  const day = value.slice(4, 6);
  const year = yy >= 50 ? 1900 + yy : 2000 + yy;
  return isoDate(year, month, day);
}

function nameFromMrz(line) {
  const cleaned = String(line || "")
    .replace(/[^A-Z<]/g, "")
    .replace(/K(?=<|$)/g, "")
    .replace(/<+$/g, "");
  if (!cleaned.includes("<")) return "";
  if (cleaned.startsWith("<<")) {
    return cleanName(cleaned.replace(/^<+/, "").split("<").filter(Boolean).join(" "));
  }
  const [surname, rest = ""] = cleaned.split("<<");
  const given = rest.split("<").filter(Boolean);
  return cleanName([...given, surname.replace(/</g, " ")].join(" "));
}

export function parseMrz(text) {
  const blob = String(text || "")
    .toUpperCase()
    .replace(/ILARE/g, "IDARE")
    .replace(/I<ARE/g, "IDARE")
    .split(/\n+/)
    .map((line) => {
      const row = line.replace(/[^A-Z0-9<]/g, "");
      if (/[A-Z]{2,}<<[A-Z]{2,}/.test(row)) return row;
      return row.replace(/[OQ]/g, "0");
    })
    .join("\n");
  const compact = blob.replace(/[\n\s]/g, "");
  const lines = blob
    .split(/\n+/)
    .map((line) => line.replace(/[^A-Z0-9<]/g, ""))
    .filter((row) => row.length >= 26);
  const mrzStart = compact.search(/I[D1]ARE/);
  const mrzBlock = mrzStart >= 0
    ? compact.slice(mrzStart, mrzStart + 92)
    : lines.filter((row) => row.includes("<") || /^\d{6,7}[MFX]/.test(row) || /I[D1]ARE/.test(row)).join("");
  const dateHit = `${lines.join("\n")}\n${mrzBlock}`.match(/(\d{6})(\d)([MFX])(\d{6})(\d)/);
  let expiry = "";
  let birthYear = "";
  if (dateHit) {
    if (icaoCheck(dateHit[1]) === dateHit[2] || mrzDate(dateHit[1])) {
      birthYear = mrzDate(dateHit[1]).slice(0, 4);
    }
    if (icaoCheck(dateHit[4]) === dateHit[5] || mrzDate(dateHit[4])) {
      expiry = mrzDate(dateHit[4]);
    }
  }
  const line3 = [...compact.matchAll(/([A-Z]{4,})<<([A-Z<]{8,})/g)]
    .map((hit) => hit[0])
    .reverse()
    .find((row) => !/L{3,}|K{3,}/.test(row.split("<<")[1] || ""))
    || compact.match(/<<([A-Z]{3,}(?:<[A-Z]{3,})+)/)?.[0]
    || lines.find((row) => /(?:[A-Z]{4,})?<<[A-Z]{3,}/.test(row) && !/^\d{6}/.test(row) && !/L{3,}|K{3,}/.test(row))
    || "";
  const ids = collectEmiratesIds(mrzBlock);
  let employeeId = ids.find((id) => birthYear && id.slice(4, 8) === birthYear) || ids[0] || "";
  if (employeeId && birthYear) employeeId = alignIdYear(employeeId, birthYear);
  const name = nameFromMrz(line3);
  if (!employeeId && !name && !expiry) return null;
  return { employeeId, name, idExpiry: expiry, birthYear };
}

function alignIdYear(id, birthYear) {
  const formatted = formatEmiratesId(id);
  if (!formatted || !birthYear || formatted.slice(4, 8) === birthYear) return formatted;
  return `${formatted.slice(0, 4)}${birthYear}${formatted.slice(8)}`;
}

function pickEmployeeId(source, mrz) {
  const ids = collectEmiratesIds(source);
  if (mrz?.birthYear) {
    const matched = ids.find((id) => id.slice(4, 8) === mrz.birthYear) || (mrz.employeeId && mrz.employeeId.slice(4, 8) === mrz.birthYear ? mrz.employeeId : "");
    if (matched) return matched;
    if (mrz.employeeId) return alignIdYear(mrz.employeeId, mrz.birthYear);
  }
  if (mrz?.employeeId) return mrz.employeeId;
  if (!ids.length) return "";
  const years = new Set(collectDates(source).map((value) => value.slice(0, 4)));
  return ids.find((id) => years.has(id.slice(4, 8))) || ids[0];
}

function cleanName(line) {
  const text = String(line || "")
    .replace(/[^A-Za-z\u0600-\u06FF' -]+/g, " ")
    .replace(/^(name|nane|naam|nom|الاسم)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 5 || SKIP_NAME.test(text)) return "";
  const letters = text.replace(/[^A-Za-z\u0600-\u06FF]/g, "");
  if (letters.length && (letters.match(/[klKL]/g) || []).length / letters.length > 0.4) return "";
  const words = text.split(" ").filter(Boolean);
  while (words.length >= 2 && words[words.length - 1].length <= 2) {
    const tail = words.pop();
    if (/^[kil]$/i.test(tail)) continue;
    if (words[words.length - 1].length >= 5 && /[aeiouy]/i.test(tail)) {
      words[words.length - 1] += tail;
    }
  }
  const kept = words.filter((word) => word.length > 1);
  if (kept.length < 2) return "";
  return kept.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

function stripTrailingJunk(name) {
  const skip = /^(are|uae|united|arab|emirates?|tiriner\w*|identity|card|golden|nationality|comoros|date|birth)$/i;
  const words = String(name || "").split(" ").filter(Boolean);
  const idx = words.findIndex((word) => skip.test(word));
  if (idx >= 2) words.length = idx;
  while (words.length && skip.test(words[words.length - 1])) words.pop();
  return words.join(" ");
}

function labeledName(text) {
  const found = [];
  const add = (raw) => {
    const clipped = String(raw || "").replace(/\b(date|birth|nationality|sex|natio\w*|united|arab|emirat|issuing|\bare\b|تاريخ).*/i, "");
    const value = plausiblePersonName(stripTrailingJunk(cleanName(clipped)));
    if (value) found.push(value);
  };
  for (const match of String(text || "").matchAll(/(?:name|الاسم)\s*[:：.=-]\s*([A-Za-z][A-Za-z0-9\u0600-\u06FF' .,_-]{3,90})/gi)) {
    if (!/<</.test(match[1])) add(match[1]);
  }
  return found.reduce((best, name) => betterName(best, name), "");
}

function nameFrom(text) {
  const labeled = labeledName(text);
  if (labeled) return labeled;
  const found = [];
  const add = (raw) => {
    const value = cleanName(String(raw || "").replace(/\b(date|birth|nationality|sex|natio\w*|تاريخ).*/i, ""));
    if (value) found.push(value);
  };
  for (const line of String(text || "").split(/\r?\n/)) {
    if (/<<|<{3,}|IDARE|ILARE/i.test(line)) continue;
    if ((line.match(/[0-9]/g) || []).length >= 6) continue;
    if ((line.match(/l/gi) || []).length >= 8) continue;
    add(line);
  }
  return found.reduce((best, name) => betterName(best, name), "");
}

function plausiblePersonName(value) {
  const name = String(value || "").trim();
  if (!name) return "";
  const words = name.split(" ").filter((word) => word.length > 1);
  if (words.length < 3 || words.length > 6) return "";
  if (words.some((word) => word.length < 3)) return "";
  if (words.some((word) => word.length >= 3 && !/[aeiouyAEIOUY\u0627\u0648\u064A]/i.test(word))) return "";
  if (words.some((word) => /[bcdfghjklmnpqrstvwxz]{5,}/i.test(word))) return "";
  const letters = name.replace(/[^A-Za-z]/g, "");
  const vowels = (letters.match(/[aeiouyAEIOUY]/g) || []).length;
  if (letters.length && vowels / letters.length < 0.28) return "";
  return name;
}

function betterName(first, second) {
  const left = plausiblePersonName(first) || String(first || "").trim();
  const right = plausiblePersonName(second) || String(second || "").trim();
  const leftOk = Boolean(plausiblePersonName(first));
  const rightOk = Boolean(plausiblePersonName(second));
  if (leftOk && !rightOk) return left;
  if (rightOk && !leftOk) return right;
  if (!left) return right;
  if (!right) return left;
  const leftKey = left.toLowerCase().replace(/\s+/g, " ");
  const rightKey = right.toLowerCase().replace(/\s+/g, " ");
  if (leftKey.startsWith(`${rightKey} `)) return right;
  if (rightKey.startsWith(`${leftKey} `)) return left;
  if (leftKey.startsWith(rightKey) || rightKey.startsWith(leftKey)) return left.length >= right.length ? left : right;
  const count = (value) => value.split(" ").filter((word) => word.length > 2).length;
  if (count(right) !== count(left)) return count(right) > count(left) ? right : left;
  return right.length > left.length ? right : left;
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
  const mrz = parseMrz(source);
  const dates = collectDates(source);
  const employeeId = pickEmployeeId(source, mrz);
  const name = plausiblePersonName(labeledName(source)) || plausiblePersonName(mrz?.name) || plausiblePersonName(nameFrom(source));
  const idExpiry = mrz?.idExpiry || expiryFrom(source, dates);
  if (!employeeId && !name && !idExpiry) return null;
  return { employeeId, name, idExpiry };
}
