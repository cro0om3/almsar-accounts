export function aed(value) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export function recomputeLine(line) {
  const quantity = Number(line.quantity) || 0;
  const unitPrice = Number(line.unitPrice) || 0;
  const taxPercent = Number(line.taxPercent) || 0;
  const grossAmount = quantity * unitPrice;
  const lineTaxAmount = grossAmount * (taxPercent / 100);
  const lineTotal = grossAmount + lineTaxAmount;
  return {
    ...line,
    quantity,
    unitPrice,
    taxPercent,
    grossAmount,
    lineTaxAmount,
    lineTotal,
    total: lineTotal,
  };
}

export function summarize(items) {
  const subtotal = items.reduce((sum, line) => sum + (Number(line.grossAmount) || 0), 0);
  const tax = items.reduce((sum, line) => sum + (Number(line.lineTaxAmount) || 0), 0);
  return { subtotal, tax, total: subtotal + tax };
}
