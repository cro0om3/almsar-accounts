const ORDER = ["pickup", "truck", "tanker", "trailer", "bus", "bobcat", "jcb", "excavator", "fleet", "record"];

export function vehicleKind(row) {
  const text = `${row.vehicleType || ""} ${row.vehicleNumber || ""}`.toLowerCase();
  if (/credit/.test(text)) return "record";
  if (/bobk|bobcat/.test(text)) return "bobcat";
  if (/\bjcb\b/.test(text)) return "jcb";
  if (/exav|excav/.test(text)) return "excavator";
  if (/bus/.test(text)) return "bus";
  if (/tank/.test(text)) return "tanker";
  if (/trail|triler/.test(text)) return "trailer";
  if (/six|weel|wheel/.test(text)) return "truck";
  if (/pickup|hilux|cabine|cabin|mitsubishi/.test(text)) return "pickup";
  if (/^[a-z][a-z\s]+$/.test(String(row.vehicleNumber || "").trim().toLowerCase())) return "record";
  return "fleet";
}

export function kindOrder(kind) {
  const index = ORDER.indexOf(kind);
  return index === -1 ? ORDER.length : index;
}
