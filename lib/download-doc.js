import { buildFooterHtml, buildInvoiceHtml, buildPurchaseOrderHtml, buildQuoteHtml } from "./letterhead";
import { customerTitle } from "./party";

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

function vehicleCell(item, kind) {
  const name = item.vehicleTypeLabel || "";
  const number = item.vehicleNumber || "";
  if (kind === "invoice") return [number, name].filter(Boolean).join(" · ");
  return name || number;
}

function rowsOf(doc, kind) {
  return (doc.items || []).map((item, index) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.unitPrice) || 0;
    const gross = Number(item.grossAmount ?? qty * rate) || 0;
    const tax = Number(item.lineTaxAmount) || 0;
    const net = Number(item.lineTotal ?? gross + tax) || 0;
    return {
      n: index + 1,
      vehicle: vehicleCell(item, kind),
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

const ADMIN = {
  companyName: COMPANY.name,
  companyNameArabic: "المسار الذكي للنقليات والصيانة العامة",
  address: `${COMPANY.address} - TEL: ${COMPANY.phone}`,
  vatNumber: COMPANY.vat,
  email: COMPANY.email,
  website: "almsaralzaki.com",
  footerAddressEnglish: COMPANY.address,
  footerContactEnglish: COMPANY.phone,
};

function branding() {
  const origin = typeof location !== "undefined" ? location.origin : "";
  return {
    logoUrl: `${origin}/branding/logo.png`,
    sealUrl: `${origin}/branding/seal.png`,
    signatureUrl: `${origin}/branding/signature.png`,
  };
}

async function companyProfile() {
  try {
    const response = await fetch("/api/company");
    if (response.ok) return await response.json();
  } catch {
    // The printed copy falls back to the built-in company details.
  }
  return null;
}

function letterBody(kind, doc, customer, profile) {
  const party = {
    name: customer?.name || doc.customerName || doc.vendorName || "",
    company: customer?.company || doc.customerCompany || "",
    address: customer?.address || doc.customerAddress || "",
    trn: customer?.trn || doc.customerTrn || "",
    phone: customer?.phone || doc.customerPhone || "",
  };
  const payload = {
    ...doc,
    currency: "AED",
    customer: party,
    subTotal: doc.subtotal ?? doc.subTotal,
    totalTax: doc.tax ?? doc.totalTax,
    total: doc.total ?? doc.amount,
  };
  const admin = profile?.admin || ADMIN;
  const brand = profile?.branding || branding();
  if (kind === "invoice") return buildInvoiceHtml(payload, admin, party, brand);
  if (kind === "po") return buildPurchaseOrderHtml(payload, admin, party, brand);
  return buildQuoteHtml(payload, admin, brand);
}

function sheetHtml(kind, doc, customer, profile) {
  if (kind === "quote" || kind === "invoice" || kind === "po") {
    const admin = profile?.admin || ADMIN;
    const brand = profile?.branding || branding();
    const footer = buildFooterHtml(admin, brand.logoUrl);
    return `<!doctype html><html><head><meta charset="utf-8"><title>${doc.number || kind}</title></head><body style="margin:18px;background:#fff;color:#111;">${letterBody(kind, doc, customer, profile)}<div style="margin-top:18px;">${footer}</div></body></html>`;
  }
  const title = kindTitle(kind);
  const party = customerTitle(customer) || customerTitle(doc) || doc.vendorName || "";
  const logo = typeof location !== "undefined" ? `${location.origin}/logo.png` : "/logo.png";
  const lines = rowsOf(doc, kind).map((row) => `
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

export async function printDocument(kind, doc, customer) {
  const profile = await companyProfile();
  const frame = document.createElement("iframe");
  frame.setAttribute("title", "print");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const win = frame.contentWindow;
  win.document.open();
  win.document.write(sheetHtml(kind, doc, customer, profile));
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
  }, 250);
}

async function shoot(html, html2canvas) {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.background = "#fff";
  container.style.padding = "8px 12px 12px";
  container.style.fontFamily = "var(--font-arabic), var(--font-latin), Arial, sans-serif";
  container.innerHTML = html;
  document.body.appendChild(container);
  await Promise.all([...container.querySelectorAll("img")].map((img) => img.complete ? null : new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  })));
  await new Promise((resolve) => setTimeout(resolve, 200));
  try {
    return await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
  } finally {
    container.remove();
  }
}

function paintPages(pdf, canvas, footer) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imgWidth = pageWidth - margin * 2;
  const footerHeight = footer ? (footer.height * imgWidth) / footer.width : 0;
  const contentHeight = Math.max(40, pageHeight - margin * 2 - footerHeight);
  const pagePx = Math.max(1, Math.floor((contentHeight * canvas.width) / imgWidth));
  let y = 0;
  let first = true;
  while (y < canvas.height - 1) {
    const sliceH = Math.min(pagePx, canvas.height - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    if (!first) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgWidth, (sliceH * imgWidth) / canvas.width);
    if (footer && footerHeight > 0) {
      const footerY = pageHeight - margin - footerHeight;
      pdf.addImage(footer.toDataURL("image/png"), "PNG", margin, footerY, imgWidth, footerHeight);
    }
    first = false;
    y += sliceH;
  }
}

export async function downloadPdf(kind, doc, customer) {
  const { jsPDF } = await import("jspdf");
  const html2canvas = (await import("html2canvas")).default;
  const profile = await companyProfile();
  const admin = profile?.admin || ADMIN;
  const brand = profile?.branding || branding();
  const canvas = await shoot(letterBody(kind, doc, customer, profile), html2canvas);
  const footer = await shoot(buildFooterHtml(admin, brand.logoUrl), html2canvas);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  paintPages(pdf, canvas, footer);
  pdf.save(`${fileBase(kind, doc)}.pdf`);
}

export async function downloadExcel(kind, doc, customer) {
  const XLSX = await import("xlsx");
  const party = customerTitle(customer) || customerTitle(doc) || doc.vendorName || "";
  const data = [
    [COMPANY.name],
    [COMPANY.address, COMPANY.phone, COMPANY.email, `VAT ${COMPANY.vat}`],
    [],
    [kindTitle(kind), doc.number || "", String(doc.date || "").slice(0, 10)],
    ["Customer", party, customer?.phone || "", customer?.email || "", customer?.trn || ""],
    [],
    ["#", "Vehicle", "Description", "Basis", "Qty", "Rate", "Gross", "VAT", "Net"],
    ...rowsOf(doc, kind).map((row) => [row.n, row.vehicle, row.description, row.basis, row.qty, row.rate, row.gross, row.tax, row.net]),
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
  try {
    const response = await fetch("/logo.png");
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    pdf.addImage(dataUrl, "PNG", pageWidth - 62, 4, 48, 20);
  } catch {
    /* header still prints without the logo */
  }
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

const RECEIPT_METHODS = {
  cash: "Cash",
  transfer: "Bank transfer",
  cheque: "Cheque",
  card: "Card",
};

export async function downloadReceipt(doc, customer) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
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
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("RECEIPT", pageWidth / 2, 44, { align: "center" });
  const party = customerTitle(customer) || customerTitle(doc) || "-";
  const lines = [
    ["Receipt", doc.number || "-"],
    ["Date", String(doc.date || "").slice(0, 10)],
    ["Received from", party],
    ["Against invoice", doc.invoiceNumber || "-"],
    ["Method", RECEIPT_METHODS[doc.method] || doc.method || "-"],
    ["Reference", doc.reference || "-"],
    ["Amount", `AED ${money(doc.amount)}`],
  ];
  let y = 58;
  pdf.setFontSize(11);
  for (const [label, value] of lines) {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, 14, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(latin(value), 62, y);
    y += 8;
  }
  const note = plain(doc.notes || "");
  if (note) {
    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.text("Being payment for", 14, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.splitTextToSize(latin(note), pageWidth - 28).forEach((line) => {
      pdf.text(line, 14, y);
      y += 5;
    });
  }
  pdf.setDrawColor(180);
  pdf.line(pageWidth - 70, 250, pageWidth - 14, 250);
  pdf.setFontSize(8);
  pdf.text("Authorized signature", pageWidth - 70, 256);
  pdf.save(`${String(doc.number || "receipt").replace(/[^\w.-]+/g, "-")}.pdf`);
}
