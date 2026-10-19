function text(value) {
  return String(value || "").trim();
}

export function customerTitle(row) {
  if (!row) return "";
  const company = text(row.company || row.customerCompany);
  const name = text(row.name || row.customerName);
  return company || name;
}

export function customerContact(row) {
  if (!row) return "";
  const company = text(row.company || row.customerCompany);
  const name = text(row.name || row.customerName);
  if (!company || !name || company === name) return "";
  return name;
}
