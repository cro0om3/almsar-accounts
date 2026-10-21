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

function expandYear(year) {
  const text = String(year || "");
  if (text.length === 4) return Number(text);
  const n = Number(text);
  if (!Number.isFinite(n)) return 0;
  return n >= 70 ? 1900 + n : 2000 + n;
}

const MONTHS = {
  jan: 1, january: 1, يناير: 1,
  feb: 2, february: 2, فبراير: 2,
  mar: 3, march: 3, مارس: 3,
  apr: 4, april: 4, ابريل: 4, أبريل: 4,
  may: 5, مايو: 5,
  jun: 6, june: 6, يونيو: 6,
  jul: 7, july: 7, يوليو: 7,
  aug: 8, august: 8, اغسطس: 8, أغسطس: 8,
  sep: 9, sept: 9, september: 9, سبتمبر: 9,
  oct: 10, october: 10, اكتوبر: 10, أكتوبر: 10,
  nov: 11, november: 11, نوفمبر: 11,
  dec: 12, december: 12, ديسمبر: 12,
};

function monthNum(value) {
  return MONTHS[String(value || "").replace(/\./g, "").toLowerCase()] || 0;
}

function normalize(text) {
  return String(text || "")
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06F0))
    .replace(/[|\\]/g, "/")
    .replace(/[•·٬]/g, ".")
    .replace(/[—–]/g, "-");
}

function collectMonthDates(text) {
  const dates = [];
  const seen = new Set();
  const add = (value) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    dates.push(value);
  };
  const source = normalize(text);
  const month = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|يناير|فبراير|مارس|ابريل|أبريل|مايو|يونيو|يوليو|اغسطس|أغسطس|سبتمبر|اكتوبر|أكتوبر|نوفمبر|ديسمبر";
  for (const match of source.matchAll(new RegExp(`(\\d{1,2})\\s*[-./]?\\s*(${month})\\s*[-./]?\\s*((?:19|20)\\d{2}|\\d{2})(?!\\d)`, "gi"))) {
    add(isoDate(expandYear(match[3]), monthNum(match[2]), match[1]));
  }
  for (const match of source.matchAll(/(\d{1,2})\D{1,3}(\d{1,2})\D{1,3}((?:19|20)\d{2})/g)) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const y = match[3];
    if (a > 12 && b <= 12) add(isoDate(y, b, a));
    else if (b > 12 && a <= 12) add(isoDate(y, a, b));
    else add(isoDate(y, b, a) || isoDate(y, a, b));
  }
  return dates;
}

function dateAfter(text, labels) {
  const source = normalize(text);
  const month = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const hit = source.match(new RegExp(`(?:${labels})[\\s\\S]{0,60}?(\\d{1,2}\\s*[-./]?\\s*(?:${month})\\s*[-./]?\\s*(?:(?:19|20)\\d{2}|\\d{2})|\\d{1,2}\\D{1,3}\\d{1,2}\\D{1,3}(?:19|20)\\d{2})`, "i"));
  if (!hit) return "";
  return collectMonthDates(hit[1])[0] || "";
}

function expiryFrom(text) {
  const labeled = dateAfter(text, "exp\\.?\\s*date|expiry\\s*date|انتهاء الترخيص|إنتهاء الترخيص");
  if (labeled) return labeled;
  const withoutIns = normalize(text)
    .replace(/reg\.?\s*date[\s\S]{0,40}/gi, " ")
    .replace(/(?:ins\.?\s*exp|insurance|policy|انتهاء التأمين|إنتهاء التأمين)[\s\S]{0,50}/gi, " ");
  const named = withoutIns.match(/(\d{1,2})\s*[-./]?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*[-./]?\s*((?:19|20)\d{2})/i);
  if (named) return isoDate(named[3], monthNum(named[2]), named[1]);
  const future = collectMonthDates(withoutIns).filter((value) => Number(value.slice(0, 4)) >= new Date().getFullYear());
  return future.sort()[0] || "";
}

function insuranceFrom(text) {
  const labeled = dateAfter(text, "ins\\.?\\s*exp|\\bxp\\.?|insurance|انتهاء التأمين|إنتهاء التأمين");
  if (labeled) return labeled;
  const month = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const short = normalize(text).match(new RegExp(`(\\d{1,2})\\s*[-./]\\s*(${month})\\s*[-./]\\s*(\\d{2})(?!\\d)`, "i"));
  if (short) return isoDate(expandYear(short[3]), monthNum(short[2]), short[1]);
  return "";
}

function alnum(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function idAfter(text, labels, min, max) {
  const source = normalize(text);
  const hit = source.match(new RegExp(`(?:${labels})[^A-Z0-9]{0,16}([A-Z0-9][A-Z0-9 \\-]{${min - 1},40})`, "i"));
  if (!hit) return "";
  const chunk = hit[1].split(/\s+(?:chassis|eng(?:ine)?|empty|weight|no\.?|رقم)\b/i)[0];
  const id = alnum(chunk);
  return id.length >= min && id.length <= max ? id : "";
}

function looksLikeVin(id) {
  if (/CHAS|ENGIN|POLICE|TRAFFIC|PLATE|LICENSE|ADPOLICE|800333/.test(id)) return false;
  const digits = (id.match(/\d/g) || []).length;
  return id.length === 17 && digits >= 6 && digits <= 14 && /^[A-HJ-NPR-Z]/.test(id) && !id.startsWith("784");
}

const VIN_VALUE = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const VIN_WEIGHT = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const VIN_SWAP = { B: "8", 8: "B", S: "5", 5: "S", G: "6", 6: "G", Z: "2", 2: "Z" };

function vinCheck(id) {
  if (id.length !== 17) return false;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const ch = id[i];
    const n = /\d/.test(ch) ? Number(ch) : VIN_VALUE[ch];
    if (n == null) return false;
    sum += n * VIN_WEIGHT[i];
  }
  const rem = sum % 11;
  return id[8] === (rem === 10 ? "X" : String(rem));
}

function repairVin(id) {
  const raw = alnum(id).replace(/O/g, "0").replace(/I/g, "1").replace(/Q/g, "0");
  if (!looksLikeVin(raw)) return "";
  if (vinCheck(raw)) return raw;
  const nissan = raw.startsWith("JNB") ? `JN8${raw.slice(3)}` : "";
  if (nissan && vinCheck(nissan)) return nissan;
  const chars = raw.split("");
  for (let i = 0; i < 17; i += 1) {
    const alt = VIN_SWAP[chars[i]];
    if (!alt) continue;
    const trial = chars.map((ch, idx) => (idx === i ? alt : ch)).join("");
    if (vinCheck(trial)) return trial;
  }
  return nissan || raw;
}

function chassisFrom(text) {
  const found = [];
  const labeled = idAfter(text, "chass\\w*|vin\\b|رقم القاعدة", 11, 17);
  if (looksLikeVin(labeled)) found.push(repairVin(labeled));
  else if (labeled.length >= 11 && labeled.length < 17) found.push(labeled);
  const around = normalize(text).match(/(?:chass\w*|vin\b|رقم القاعدة)[\s\S]{0,80}/i);
  if (around) {
    const compact = alnum(around[0]);
    for (let i = 0; i <= Math.max(0, compact.length - 17); i += 1) {
      const id = compact.slice(i, i + 17);
      if (looksLikeVin(id)) found.push(repairVin(id));
    }
  }
  for (const match of normalize(text).toUpperCase().matchAll(/\b([A-HJ-NPR-Z][A-HJ-NPR-Z0-9]{16})\b/g)) {
    const id = alnum(match[1]);
    if (looksLikeVin(id)) found.push(repairVin(id));
  }
  const unique = [...new Set(found.filter(Boolean))];
  return unique.find((id) => vinCheck(id)) || unique.find((id) => id.startsWith("JN")) || unique[0] || "";
}

function colorFrom(text) {
  const source = normalize(text);
  const arabic = [
    [/ا?س\s*ود|أسود/i, "أسود"],
    [/ابيض|أبيض/i, "أبيض"],
    [/فضي/i, "فضي"],
    [/رمادي/i, "رمادي"],
    [/احمر|أحمر/i, "أحمر"],
    [/ازرق|أزرق/i, "أزرق"],
    [/اخضر|أخضر/i, "أخضر"],
    [/بني/i, "بني"],
    [/بيج/i, "بيج"],
    [/خمري/i, "خمري"],
    [/برتقالي/i, "برتقالي"],
    [/اصفر|أصفر/i, "أصفر"],
  ];
  for (const [re, value] of arabic) {
    if (re.test(source)) return value;
  }
  const labeled = source.match(/(?:colou?r|لون المركبة|\bلون\b)[\s\S]{0,40}/i);
  if (!labeled) return "";
  const english = [
    [/black/i, "أسود"],
    [/white/i, "أبيض"],
    [/silver/i, "فضي"],
    [/gr[ae]y/i, "رمادي"],
    [/red/i, "أحمر"],
    [/blue/i, "أزرق"],
    [/green/i, "أخضر"],
    [/brown/i, "بني"],
  ];
  for (const [re, value] of english) {
    if (re.test(labeled[0])) return value;
  }
  return "";
}

function plateFrom(text) {
  const source = normalize(text);
  const labeled = source.match(/(?:traffic\s*plate|plate\s*no|رقم اللوحة)[\s\S]{0,40}?([A-Z0-9]{1,3})\s*[\/1I|]\s*(\d{3,6})/i);
  if (labeled && labeled[2].length <= 6) return `${labeled[1].toUpperCase()}/${labeled[2]}`;
  const loose = source.match(/\b(\d{1,2}|[A-Z]{1,2})\s*[\/]\s*(\d{4,6})\b/);
  if (loose) return `${loose[1].toUpperCase()}/${loose[2]}`;
  const jammed = source.match(/\b(\d{1,2})[1I](\d{4,6})\b/);
  if (jammed && jammed[2].length >= 4 && jammed[2].length <= 6) return `${jammed[1]}/${jammed[2]}`;
  const only = alnum(source);
  if (/^\d{7}$/.test(only) && only[1] === "1") return `${only[0]}/${only.slice(2)}`;
  return "";
}

function categoryFrom(text) {
  const source = normalize(text);
  if (/خصوص|خخوص|خصوي|صوصي|private|khosus|khusus/i.test(source)) return "خصوصي";
  if (/عمومي|public/i.test(source)) return "عمومي";
  if (/أجر|اجرة|أجرة|taxi/i.test(source)) return "أجرة";
  if (/\bنقل\b|transport/i.test(source)) return "نقل";
  return "";
}

function yearFrom(text) {
  const source = normalize(text);
  const labeled = source.match(/(?:سنة الصنع|year\s*made|model|صنع)\D{0,16}((?:19|20)\d{2})/i);
  if (labeled) return labeled[1];
  const before = source.match(/((?:19|20)\d{2})\D{0,16}(?:سنة الصنع|model|صنع|\bnum\b)/i);
  if (before) return before[1];
  const bracket = source.match(/[\[(]((?:19|20)\d{2})/);
  if (bracket) return bracket[1];
  return "";
}

const BRANDS = "NISSAN|TOYOTA|MITSUBISHI|ISUZU|FORD|CHEVROLET|CHEVY|MERCEDES|HINO|LEXUS|GMC|BMW|HONDA|HYUNDAI|KIA|VOLVO|SCANIA|MAN|MAZDA|SUZUKI|RENAULT|PEUGEOT|LAND\\s*ROVER|RANGE\\s*ROVER";
const MODELS = "PATROL|SUNNY|TIIDA|NAVARA|X[- ]?TRAIL|CIVIC|ACCORD|CAMRY|COROLLA|HILUX|HIACE|PRADO|FORTUNER|LAND\\s*CRUISER|COASTER|DYNA|RANGER|F[- ]?150|SILVERADO|PAJERO|L200|CANTER|ACTROS|ATEGO|GTR|URVAN|CIVILIAN|TUNDRA|TACOMA|YARIS|AVALON|INNOVA|PREMIO|AQUA|STARIA|PORTER|MIGHTY|DMAX|MUX";
const SKIP_WORD = /^(vehicle|information|license|united|arab|origin|japan|model|chassis|empty|weight|pass|type|authority|gvw|eng|no|josili|glu)$/i;

function cleanType(value) {
  const words = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .split(" ")
    .filter((word) => word.length >= 2 && !SKIP_WORD.test(word) && !/^\d+$/.test(word));
  if (!words.length) return "";
  const brandAt = words.findIndex((word) => new RegExp(`^(?:${BRANDS})$`, "i").test(word));
  const start = brandAt >= 0 ? brandAt : 0;
  return words.slice(start, start + 2).join(" ");
}

function vehicleTypeFrom(text) {
  const source = normalize(text);
  const known = source.match(new RegExp(`\\b((?:${BRANDS})\\s+(?:${MODELS}))\\b`, "i"));
  if (known) return cleanType(known[1]);
  const labeled = source.match(/(?:veh(?:icle)?\.?\s*type|نوع المركبة)[^A-Za-z]{0,16}([A-Za-z][A-Za-z0-9 \-]{2,28})/i);
  if (labeled) {
    const value = cleanType(labeled[1]);
    if (value) return value;
  }
  const brand = source.match(new RegExp(`\\b((?:${BRANDS})\\s+[A-Z][A-Z-]{2,16})\\b`, "i"));
  if (brand) return cleanType(brand[1]);
  return "";
}

export function parseVehicleLicense(text) {
  const source = normalize(text);
  const vehicleNumber = plateFrom(source);
  const category = categoryFrom(source);
  const ownershipExpiry = expiryFrom(source);
  const insuranceExpiry = insuranceFrom(source);
  const vehicleType = vehicleTypeFrom(source);
  const year = yearFrom(source);
  const chassisNumber = chassisFrom(source);
  const color = colorFrom(source);
  if (!vehicleNumber && !category && !ownershipExpiry && !insuranceExpiry && !vehicleType && !year && !chassisNumber && !color) return null;
  return { vehicleNumber, category, ownershipExpiry, insuranceExpiry, vehicleType, year, chassisNumber, color };
}

export function sideOf(parsed) {
  if (!parsed) return "";
  if (parsed.vehicleNumber || parsed.ownershipExpiry || parsed.insuranceExpiry) return "front";
  if (parsed.chassisNumber || parsed.vehicleType) return "back";
  return "";
}
