const COMPANY = {
  name: "ALMSAR ALZAKI TRANSPORT AND GENERAL MAINTENANCE",
  address: "Al Sila, Hamdan Street, Abu Dhabi",
  phone: "+971 54 311 4444",
  email: "info@almsaralzaki.com",
  vat: "105061702400003",
};

function latin(value) {
  return String(value ?? "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\n\r\t\x20-\xFF]/g, "");
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function plain(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function kindTitle(kind) {
  if (kind === "invoice") return "TAX INVOICE";
  if (kind === "po") return "PURCHASE ORDER";
  return "QUOTATION";
}

function fileBase(kind, doc) {
  const number = String(doc.number || kind).replace(/[^\w.-]+/g, "-");
  return number;
}

function rowsOf(doc) {
  return (doc.items || []).map((item, index) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.unitPrice) || 0;
    const gross = Number(item.grossAmount ?? qty * rate) || 0;
    const tax = Number(item.lineTaxAmount) || 0;
    const net = Number(item.lineTotal ?? gross + tax) || 0;
    return {
      n: index + 1,
      vehicle: item.vehicleNumber || "",
      description: item.description || item.vehicleTypeLabel || "",
      basis: item.rentalBasis || "",
      qty,
      rate,
      gross,
      tax,
      net,
    };
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function sheetHtml(kind, doc, customer) {
  const title = kindTitle(kind);
  const party = customer?.name || doc.customerName || doc.vendorName || "";
  const logo = typeof location !== "undefined" ? `${location.origin}/logo.png` : "/logo.png";
  const lines = rowsOf(doc).map((row) => `
    <tr>
      <td>${row.n}</td>
      <td>${row.vehicle}</td>
      <td>${row.description}</td>
      <td>${row.basis}</td>
      <td>${row.qty}</td>
      <td>${money(row.rate)}</td>
      <td>${money(row.gross)}</td>
      <td>${money(row.tax)}</td>
      <td>${money(row.net)}</td>
    </tr>`).join("");
  const terms = plain(doc.terms || doc.notes || "").replace(/\n/g, "<br>");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${doc.number || title}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
      h1 { font-size: 18px; margin: 0; }
      h2 { text-align: center; letter-spacing: 1px; margin: 16px 0; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #111; padding: 6px 8px; font-size: 12px; text-align: left; }
      th { background: #f3f4f6; }
      .top { display: flex; justify-content: space-between; gap: 24px; }
      .right { text-align: right; }
      .muted { color: #444; font-size: 12px; line-height: 1.5; }
    </style></head><body>
    <div class="top">
      <div>
        <img src="${logo}" alt="" style="height:62px;margin-bottom:8px;" />
        <h1>${COMPANY.name}</h1>
        <div class="muted">${COMPANY.address}<br>Tel: ${COMPANY.phone}<br>${COMPANY.email}<br>VAT: ${COMPANY.vat}</div>
      </div>
      <div class="right muted"><strong>${title}</strong><br>${doc.number || ""}<br>${String(doc.date || "").slice(0, 10)}</div>
    </div>
    <h2>${title}</h2>
    <div class="muted"><strong>${kind === "po" ? "Vendor" : "Customer"}:</strong> ${party}<br>
      ${customer?.phone || ""} ${customer?.email || ""}<br>${customer?.address || ""}<br>${customer?.trn ? "TRN: " + customer.trn : ""}</div>
    <table>
      <thead><tr><th>#</th><th>Vehicle</th><th>Description</th><th>Basis</th><th>Qty</th><th>Rate</th><th>Gross</th><th>VAT</th><th>Net</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <p class="right"><strong>Subtotal:</strong> AED ${money(doc.subtotal)}<br><strong>VAT:</strong> AED ${money(doc.tax)}<br><strong>Total:</strong> AED ${money(doc.total)}</p>
    ${terms ? `<h3>Terms</h3><div class="muted">${terms}</div>` : ""}
    </body></html>`;
}

export function printDocument(kind, doc, customer) {
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "print");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  win.document.open();
  win.document.write(sheetHtml(kind, doc, customer));
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}

export async function downloadPdf(kind, doc, customer) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const write = pdf.text.bind(pdf);
  pdf.text = (text, x, y, options) => write(Array.isArray(text) ? text.map(latin) : latin(text), x, y, options);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let y = 42;

  function need(height) {
    if (y + height > pageHeight - 32) {
      pdf.addPage();
      y = 16;
    }
  }

  pdf.setFillColor(14, 39, 68);
  pdf.rect(0, 0, pageWidth, 32, "F");
  try {
    const response = await fetch("/logo.png");
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    pdf.addImage(dataUrl, "PNG", 8, 6, 20, 20);
  } catch {
    /* header still prints without the logo */
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(COMPANY.name, 36, 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(`${COMPANY.address}  |  Tel: ${COMPANY.phone}`, 36, 18);
  pdf.text(`${COMPANY.email}  |  VAT: ${COMPANY.vat}`, 36, 23);
  pdf.setTextColor(28, 36, 48);
  y = 42;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(kindTitle(kind), pageWidth / 2, y, { align: "center" });
  y += 8;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const party = customer?.name || doc.customerName || doc.vendorName || "-";
  pdf.text(`${kind === "invoice" ? "Invoice" : kind === "po" ? "PO" : "Quotation"}: ${doc.number || "-"}`, 14, y);
  pdf.text(`Date: ${String(doc.date || "").slice(0, 10)}`, pageWidth - 14, y, { align: "right" });
  y += 5;
  pdf.text(`${kind === "po" ? "Vendor" : "Customer"}: ${party}`, 14, y);
  y += 5;
  if (doc.poNumbers) {
    pdf.text(`Customer PO: ${doc.poNumbers}`, 14, y);
    y += 5;
  }
  const contact = [customer?.phone, customer?.email, customer?.trn ? `TRN ${customer.trn}` : ""].filter(Boolean).join("   ");
  if (contact) {
    pdf.text(contact, 14, y);
    y += 5;
  }
  y += 2;

  const columns = [14, 22, 46, 110, 128, 146, 162, 178, 194];
  const headers = ["#", "Vehicle", "Description", "Basis", "Qty", "Rate", "Gross", "VAT", "Net"];
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  headers.forEach((label, index) => pdf.text(label, columns[index], y));
  y += 2;
  pdf.line(14, y, pageWidth - 10, y);
  y += 5;
  pdf.setFont("helvetica", "normal");

  rowsOf(doc).forEach((row) => {
    const description = pdf.splitTextToSize(String(row.description || ""), 60);
    const height = Math.max(5, description.length * 4);
    need(height + 2);
    pdf.text(String(row.n), columns[0], y);
    pdf.text(pdf.splitTextToSize(String(row.vehicle || ""), 22)[0] || "", columns[1], y);
    pdf.text(description, columns[2], y);
    pdf.text(String(row.basis || ""), columns[3], y);
    pdf.text(String(row.qty), columns[4], y);
    pdf.text(money(row.rate), columns[5], y);
    pdf.text(money(row.gross), columns[6], y);
    pdf.text(money(row.tax), columns[7], y);
    pdf.text(money(row.net), columns[8], y);
    y += height + 1;
  });

  y += 4;
  need(20);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Subtotal: AED ${money(doc.subtotal)}`, pageWidth - 14, y, { align: "right" });
  y += 5;
  pdf.text(`VAT: AED ${money(doc.tax)}`, pageWidth - 14, y, { align: "right" });
  y += 5;
  pdf.text(`Total: AED ${money(doc.total)}`, pageWidth - 14, y, { align: "right" });
  y += 8;

  const terms = plain(doc.terms || doc.notes || "");
  if (terms) {
    pdf.setFont("helvetica", "bold");
    need(8);
    pdf.text("Terms & conditions", 14, y);
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.splitTextToSize(terms, pageWidth - 28).forEach((line) => {
      need(4);
      pdf.text(line, 14, y);
      y += 4;
    });
  }

  const signY = Math.min(y + 18, pageHeight - 20);
  pdf.setDrawColor(180);
  pdf.line(pageWidth - 70, signY, pageWidth - 14, signY);
  pdf.setFontSize(8);
  pdf.text("Authorized signature", pageWidth - 70, signY + 5);
  pdf.save(`${fileBase(kind, doc)}.pdf`);
}

export async function downloadExcel(kind, doc, customer) {
  const XLSX = await import("xlsx");
  const party = customer?.name || doc.customerName || doc.vendorName || "";
  const data = [
    [COMPANY.name],
    [COMPANY.address, COMPANY.phone, COMPANY.email, `VAT ${COMPANY.vat}`],
    [],
    [kindTitle(kind), doc.number || "", String(doc.date || "").slice(0, 10)],
    ["Customer", party, customer?.phone || "", customer?.email || "", customer?.trn || ""],
    [],
    ["#", "Vehicle", "Description", "Basis", "Qty", "Rate", "Gross", "VAT", "Net"],
    ...rowsOf(doc).map((row) => [row.n, row.vehicle, row.description, row.basis, row.qty, row.rate, row.gross, row.tax, row.net]),
    [],
    ["", "", "", "", "", "", "Subtotal", doc.subtotal || 0],
    ["", "", "", "", "", "", "VAT", doc.tax || 0],
    ["", "", "", "", "", "", "Total", doc.total || 0],
  ];
  const terms = plain(doc.terms || doc.notes || "");
  if (terms) data.push([], ["Terms"], [terms]);
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, kindTitle(kind).slice(0, 31));
  XLSX.writeFile(book, `${fileBase(kind, doc)}.xlsx`);
}

export async function downloadPayslip(row) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(14, 39, 68);
  pdf.rect(0, 0, pageWidth, 28, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(latin(COMPANY.name), 14, 12);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("PAYSLIP", 14, 20);
  pdf.setTextColor(28, 36, 48);
  let y = 40;
  const base = Number(row.baseSalary) || 0;
  const overtime = (Number(row.overtimeHours) || 0) * (Number(row.overtimeRate) || 0);
  const deductions = Number(row.deductions) || 0;
  const net = base + overtime - deductions;
  const lines = [
    ["Employee", row.employeeName || "-"],
    ["Month", String(row.month || "").slice(0, 7)],
    ["Basic salary", `AED ${money(base)}`],
    ["Overtime", `AED ${money(overtime)}`],
    ["Deductions", `AED ${money(deductions)}`],
    ["Net pay", `AED ${money(row.netPay ?? net)}`],
  ];
  pdf.setFontSize(11);
  for (const [label, value] of lines) {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, 14, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(latin(value), 70, y);
    y += 8;
  }
  if (row.notes) {
    y += 4;
    pdf.setFontSize(9);
    pdf.text(latin(row.notes), 14, y, { maxWidth: pageWidth - 28 });
  }
  pdf.line(14, 250, 80, 250);
  pdf.setFontSize(8);
  pdf.text("Authorized signature", 14, 256);
  const name = String(row.employeeName || "payslip").replace(/[^\w.-]+/g, "-");
  pdf.save(`${name}-${String(row.month || "").slice(0, 7)}.pdf`);
}
