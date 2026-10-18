"use strict";

function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(v) {
  const s = String(v || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return esc(v || "-");
  return s.slice(8, 10) + "-" + s.slice(5, 7) + "-" + s.slice(0, 4);
}

function formatDuration(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (m) {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const idx = parseInt(m[2], 10) - 1;
    if (idx >= 0 && idx < 12) return months[idx] + " " + m[1];
  }
  return s;
}

function formatMoney(v) {
  const n = Number(v || 0);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPhone(raw) {
  const d = String(raw || "").replace(/[^\d+]/g, "");
  if (!d) return "";
  if (d.startsWith("+")) return d;
  if (d.startsWith("00971")) return "+971" + d.slice(5);
  if (d.startsWith("971")) return "+" + d;
  if (d.startsWith("0")) return "+971" + d.slice(1);
  return d;
}

function splitAddress(address) {
  const s = String(address || "");
  const m = s.match(/TEL\s*:?\s*([+\d\s-]+)/i);
  const phone = m ? m[1].trim() : "";
  const place = s.replace(/[-–]?\s*TEL\s*:?\s*[+\d\s-]+/i, "").replace(/\s*[-–]\s*$/, "").trim();
  return { place, phone };
}

const LICENSE_COMPANY_AR = "المسار الذكي للنقليات والصيانة العامة";
const LICENSE_COMPANY_EN = "ALMSAR ALZAKI TRANSPORT AND GENERAL MAINTENANCE";
const LICENSE_COMPANY_SUB = "Transport and General Maintenance Co.";

function companyArabic(admin) {
  const name = (admin && (admin.companyNameArabic || "").trim()) || "";
  return name || LICENSE_COMPANY_AR;
}

function companyEnglish(admin) {
  const name = (admin && (admin.companyName || "").trim()) || "";
  return name || LICENSE_COMPANY_EN;
}

function companyPhone(admin) {
  const fromAddr = splitAddress(admin && admin.address).phone;
  const fromFooter = (admin && admin.footerContactEnglish) || "";
  return formatPhone(fromAddr || fromFooter);
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function chunkToWords(n) {
  n = Math.floor(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + chunkToWords(n % 100) : "");
}

function toWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "Zero";
  const parts = [];
  const billion = Math.floor(n / 1e9);
  const million = Math.floor((n % 1e9) / 1e6);
  const thousand = Math.floor((n % 1e6) / 1000);
  const rest = n % 1000;
  if (billion) parts.push(chunkToWords(billion) + " Billion");
  if (million) parts.push(chunkToWords(million) + " Million");
  if (thousand) parts.push(chunkToWords(thousand) + " Thousand");
  if (rest) parts.push(chunkToWords(rest));
  return parts.join(" ");
}

function amountInWords(amount, currency) {
  const n = Math.round(Number(amount || 0) * 100) / 100;
  const whole = Math.floor(n);
  const fils = Math.round((n - whole) * 100);
  const unit = String(currency || "AED").toUpperCase() === "AED" ? "Dirham" : String(currency || "AED");
  let out = toWords(whole) + " " + unit;
  if (fils) out += " and " + toWords(fils) + " Fils";
  return out + " only";
}

function htmlToLines(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .split(/\n+/)
    .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseTerms(html) {
  const lines = htmlToLines(html);
  let payment = "";
  const terms = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^payment terms\b/i.test(line) && line.length < 80) {
      const after = line.replace(/^payment terms\s*:?\s*/i, "").trim();
      if (after) payment = after;
      else if (lines[i + 1] && !/terms/i.test(lines[i + 1])) payment = lines[++i];
      continue;
    }
    if (/^(quotation|invoice|purchase order)?\s*terms\s*(&|and)?\s*conditions/i.test(line) && line.length < 80) continue;
    terms.push(line);
  }
  return { payment, terms };
}

function infoRow(label, value) {
  if (!value && value !== 0) return "";
  return `<tr>
    <td style="padding:2px 10px 2px 0;vertical-align:top;font-weight:700;white-space:nowrap;width:140px;">${esc(label)}</td>
    <td style="padding:2px 0;vertical-align:top;">${esc(value)}</td>
  </tr>`;
}

function buildHeaderHtml(admin, branding) {
  const logoUrl = branding && branding.logoUrl;
  const logo = logoUrl
    ? `<img src="${esc(logoUrl)}" style="width:210px;max-width:42%;height:auto;object-fit:contain;" />`
    : `<div style="width:78px;height:78px;"></div>`;
  return `<div style="display:flex;align-items:center;gap:14px;padding:0 0 8px;border-bottom:2.5px solid #111;margin-bottom:12px;">
    ${logo}
    <div style="flex:1;text-align:center;">
      <div dir="rtl" style="font-size:16px;font-weight:700;line-height:1.35;">${esc(companyArabic(admin))}</div>
      <div style="font-size:15px;font-weight:800;letter-spacing:.2px;margin-top:3px;text-transform:uppercase;">${esc(companyEnglish(admin))}</div>
      <div style="font-size:12px;font-style:italic;margin-top:2px;">${esc((admin && admin.tagline) || LICENSE_COMPANY_SUB)}</div>
      <div style="font-family:Times New Roman,Times,serif;font-size:13px;font-style:italic;margin-top:3px;">${esc((admin && admin.headerNote) || "(Approved Oil & Gas Field Supplier)")}</div>
    </div>
    <div style="width:78px;flex-shrink:0;"></div>
  </div>`;
}

function buildFooterHtml(admin, logoUrl) {
  const logo = logoUrl
    ? `<img src="${esc(logoUrl)}" style="width:150px;height:auto;object-fit:contain;" />`
    : "";
  const branch = (admin && (admin.footerAddressEnglish || splitAddress(admin.address).place) || "").trim();
  const vat = (admin && admin.vatNumber) || "";
  const phone = companyPhone(admin);
  let email = (admin && (admin.email || admin.companyEmail) || "").trim();
  if (!email || /almsar\.uae@gmail\.com/i.test(email)) email = "info@almasaralzaki.com";
  const website = (admin && admin.website || "").trim();
  const lines = [];
  if (branch) lines.push(`<div style="margin:0 0 3px;">Branch Address : ${esc(branch)}</div>`);
  if (vat) lines.push(`<div style="margin:0 0 3px;">Vat No : ${esc(vat)}</div>`);
  if (phone) lines.push(`<div style="margin:0 0 3px;">Phone no : ${esc(phone)}</div>`);
  if (email) lines.push(`<div style="margin:0 0 3px;">Email : ${esc(email)}</div>`);
  if (website) lines.push(`<div style="margin:0;">Website : ${esc(website)}</div>`);
  if (!lines.length) return "";
  return `<div style="border-top:2.5px solid #111;padding-top:10px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;">
    <div>${logo}</div>
    <div style="text-align:right;font-size:11px;font-weight:700;line-height:1.55;">${lines.join("")}</div>
  </div>`;
}

function watermarkHtml(logoUrl) {
  if (!logoUrl) return "";
  return `<div style="position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);opacity:0.07;pointer-events:none;z-index:0;">
    <img src="${esc(logoUrl)}" style="width:460px;max-width:80%;height:auto;object-fit:contain;" />
  </div>`;
}

function rentalLabel(v) {
  const s = String(v || "").toLowerCase();
  if (s === "hourly") return "Hourly Basis";
  if (s === "monthly") return "Monthly Basis";
  if (s === "weekly") return "Weekly Basis";
  if (s === "daily") return "Daily Basis";
  return v || "-";
}

function itemDescription(item) {
  const bits = [];
  const main = item.description || item.vehicleTypeLabel || "";
  if (main) bits.push(String(main).toUpperCase());
  if (item.vehicleNumber && String(item.vehicleNumber) !== "-") bits.push("Vehicle: " + item.vehicleNumber);
  if (item.make || item.model) bits.push([item.make, item.model].filter(Boolean).join(" "));
  return bits.join("\n") || "-";
}

function letterItemsTable(items) {
  const th = "border:1px solid #111;padding:9px 8px;font-size:11px;font-weight:700;text-align:center;background:#f8fafc;vertical-align:middle;";
  const td = "border:1px solid #111;padding:9px 8px;font-size:11px;vertical-align:middle;line-height:1.45;";
  const rows = (items || []).map((item, index) => {
    const gross = item.grossAmount ?? (Number(item.quantity || 0) * Number(item.unitPrice || 0));
    const tax = item.lineTaxAmount ?? item.tax ?? 0;
    const net = item.lineTotal ?? item.total ?? (gross + tax);
    const desc = esc(itemDescription(item)).replace(/\n/g, "<br>");
    return `<tr>
      <td style="${td}text-align:center;">${esc(item.serialNumber ?? index + 1)}</td>
      <td style="${td}text-align:left;font-weight:600;padding-left:10px;padding-right:10px;">${desc}</td>
      <td style="${td}text-align:center;">${esc(item.quantity ?? "-")}</td>
      <td style="${td}text-align:right;padding-right:10px;">${formatMoney(item.unitPrice)}</td>
      <td style="${td}text-align:center;">${esc(rentalLabel(item.rentalBasis))}</td>
      <td style="${td}text-align:center;">${esc(item.duration ?? "-")}</td>
      <td style="${td}text-align:right;padding-right:10px;">${formatMoney(gross)}</td>
      <td style="${td}text-align:right;padding-right:10px;">${formatMoney(tax)}</td>
      <td style="${td}text-align:right;font-weight:700;padding-right:10px;">${formatMoney(net)}</td>
    </tr>`;
  }).join("");
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;margin:12px 0 10px;border:1px solid #111;">
    <colgroup>
      <col style="width:5%"><col style="width:30%"><col style="width:6%"><col style="width:10%">
      <col style="width:11%"><col style="width:8%"><col style="width:11%"><col style="width:8%"><col style="width:11%">
    </colgroup>
    <thead><tr>
      <th style="${th}">#</th>
      <th style="${th}">Item Description</th>
      <th style="${th}">Qty</th>
      <th style="${th}">Rate</th>
      <th style="${th}">Rent Basis</th>
      <th style="${th}">Duration</th>
      <th style="${th}">Basic Amount</th>
      <th style="${th}">VAT</th>
      <th style="${th}">Amount</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="9" style="${td}text-align:center;">No items</td></tr>`}</tbody>
  </table>`;
}

function termsTable(title, terms) {
  if (!terms || !terms.length) return "";
  const rows = terms.map((t, i) => {
    const num = String(i + 1).padStart(2, "0");
    return `<tr>
      <td style="border:1px solid #111;padding:9px 12px;font-size:11px;line-height:1.55;vertical-align:top;"><strong style="margin-right:6px;">${num}.</strong>${esc(t)}</td>
    </tr>`;
  }).join("");
  return `<div style="margin-top:16px;">
    <div style="text-align:center;font-weight:700;text-decoration:underline;margin-bottom:8px;font-size:13px;">${esc(title)}</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #111;">${rows}</table>
  </div>`;
}

function signOffHtml(admin, branding, kind) {
  const sealUrl = branding && branding.sealUrl;
  const signatureUrl = branding && branding.signatureUrl;
  let stamp = "";
  if (sealUrl && signatureUrl) {
    stamp = `<div style="position:relative;width:170px;height:150px;margin:4px 0 2px;">
      <img src="${esc(sealUrl)}" style="height:140px;width:140px;object-fit:contain;position:absolute;left:0;top:0;" />
      <img src="${esc(signatureUrl)}" style="height:72px;object-fit:contain;position:absolute;left:48px;top:68px;" />
    </div>`;
  } else if (sealUrl) {
    stamp = `<img src="${esc(sealUrl)}" style="height:140px;object-fit:contain;margin:4px 0;" />`;
  } else if (signatureUrl) {
    stamp = `<img src="${esc(signatureUrl)}" style="height:72px;object-fit:contain;margin:4px 0;" />`;
  } else {
    stamp = `<div style="height:90px;"></div>`;
  }
  const boxLabel = kind === "invoice"
    ? "Signing here implies acceptance of this tax invoice"
    : "Signing here implies the hirer's acceptance of the above terms & conditions";
  return `<div style="margin-top:22px;display:flex;justify-content:space-between;gap:24px;align-items:flex-start;">
    <div style="flex:1;">
      <div style="color:#64748b;margin-bottom:10px;">Thanking You,</div>
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;margin-bottom:4px;">${esc(companyEnglish(admin))}</div>
      ${stamp}
      <div style="margin-top:4px;font-weight:800;text-decoration:underline;color:#1e3a5f;">AUTHORISED SIGNATORY</div>
    </div>
    <div style="width:250px;">
      <div style="border:1px solid #111;min-height:90px;padding:8px;font-size:10px;color:#334155;">${esc(boxLabel)}</div>
      <div style="text-align:center;margin-top:10px;font-weight:700;color:#1e3a5f;">(Approval By Customer)</div>
      <div style="text-align:center;font-weight:700;color:#1e3a5f;">Authorised Signatory</div>
    </div>
  </div>`;
}

function buildDocumentHtml(kind, doc, admin, party, branding) {
  const currency = doc.currency || (admin && admin.currency) || "AED";
  const isQuote = kind === "quote";
  const isInvoice = kind === "invoice";
  const isPo = kind === "po";
  const numberLabel = isQuote ? "Quotation:" : isInvoice ? "Tax Invoice:" : "Purchase Order:";
  const dateLabel = isQuote ? "Estimation Date:" : isInvoice ? "Invoice Date:" : "PO Date:";
  const extraLabel = isQuote ? "Expiry Date:" : isInvoice ? "Due Date:" : "";
  const extraValue = isQuote ? doc.validUntil : isInvoice ? doc.dueDate : "";
  const termsTitle = isQuote ? "Quotation Terms & Conditions" : isInvoice ? "Tax Invoice Terms & Conditions" : "Purchase Order Terms & Conditions";
  const intro = isQuote
    ? "With reference to your enquiry regarding our Equipment Rental / Transport Services, we are pleased to quote you our best prices as follows:"
    : isInvoice
      ? "With reference to the services rendered, please find our tax invoice as follows:"
      : "Please supply the following items as per the details below:";
  const titleHtml = isInvoice
    ? '<h2 style="text-align:center;margin:4px 0 10px;font-size:18px;letter-spacing:.5px;text-decoration:underline;">TAX INVOICE</h2>'
    : "";
  const subject = (doc.notes && String(doc.notes).replace(/<[^>]+>/g, "").trim().split("\n")[0])
    || (isQuote || isInvoice ? "Supply of Equipment" : "Purchase Order");
  const defaultTerms = isInvoice
    ? (admin && (admin.defaultInvoiceTerms || admin.defaultTerms))
    : isPo
      ? (admin && (admin.defaultPurchaseOrderTerms || admin.defaultTerms))
      : (admin && admin.defaultTerms);
  const parsed = parseTerms(doc.terms || defaultTerms || "");
  const payment = parsed.payment || (isInvoice && doc.dueDate ? ("Due date: " + formatDate(doc.dueDate)) : "30 days from the day of invoice submission.");
  const addr = splitAddress(admin && admin.address);
  const place = addr.place || "Abu Dhabi";
  const partyName = party && (party.company || party.name) || "-";
  const partyAddr = party && party.address || "-";
  const partyVat = (party && (party.trn || party.vatNumber)) || "-";
  const partyPhone = (party && party.phone) || "-";
  const partyFax = (party && party.fax) || "-";
  const subTotal = doc.subTotal ?? doc.subtotal ?? 0;
  const tax = doc.totalTax ?? doc.tax ?? 0;
  const total = doc.total ?? doc.amount ?? 0;
  const items = doc.items || [];
  const salesPerson = doc.salesPerson || doc.salesPersonName || "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;position:relative;padding:4px 2px 8px;">
    ${watermarkHtml(branding && branding.logoUrl)}
    <div style="position:relative;z-index:1;">
      ${buildHeaderHtml(admin, branding)}
      ${titleHtml}
      <div style="display:flex;justify-content:space-between;gap:28px;margin:8px 0 14px;font-size:12px;">
        <div style="flex:1;">
          <div style="text-decoration:underline;font-weight:700;margin-bottom:8px;">Document Information</div>
          <table style="border-collapse:collapse;">
            ${infoRow(numberLabel, doc.number)}
            ${infoRow(dateLabel, formatDate(doc.date))}
            ${extraLabel ? infoRow(extraLabel, extraValue ? formatDate(extraValue) : "-") : ""}
            ${salesPerson ? infoRow("Sales Person:", salesPerson) : ""}
            ${infoRow("Place of Supply:", place)}
            ${isInvoice ? infoRow("Duration:", formatDuration(doc.duration) || "-") : ""}
          </table>
        </div>
        <div style="flex:1;">
          <div style="text-decoration:underline;font-weight:700;margin-bottom:8px;">${isPo ? "Vendor Information" : "Customer Information"}</div>
          <table style="border-collapse:collapse;">
            ${infoRow("Name:", partyName)}
            ${infoRow("Address:", partyAddr)}
            ${infoRow("VAT No:", partyVat)}
            ${infoRow("Phone:", partyPhone)}
            ${infoRow("Fax:", partyFax)}
          </table>
        </div>
      </div>
      <p style="margin:0 0 10px;font-size:12px;"><strong>Subject:</strong> ${esc(subject)}</p>
      <p style="margin:0 0 4px;font-size:12px;">Dear Sir,</p>
      <p style="margin:0 0 12px;font-size:12px;">${esc(intro)}</p>
      ${letterItemsTable(items)}
      <div style="text-align:right;font-size:12px;margin:8px 0 6px;line-height:1.7;">
        <div><strong>Sub Total(In ${esc(currency)}) :</strong> ${formatMoney(subTotal)}</div>
        <div><strong>Total Vat Amount(In ${esc(currency)}) :</strong> ${formatMoney(tax)}</div>
        <div><strong>Grand Total(In ${esc(currency)}):</strong> ${formatMoney(total)}</div>
      </div>
      <p style="text-align:center;font-size:12px;margin:8px 0 12px;"><strong>Grand Total (in words): ${esc(currency)} : ${esc(amountInWords(total, currency))}</strong></p>
      <div style="text-align:center;font-weight:700;text-decoration:underline;margin:12px 0 8px;">Payment Terms</div>
      <div style="border:1px solid #111;padding:10px 12px;font-size:12px;line-height:1.5;">${esc(payment)}</div>
      ${termsTable(termsTitle, parsed.terms)}
      ${signOffHtml(admin, branding || {}, kind)}
    </div>
  </div>`;
}

function buildQuoteHtml(quote, admin, branding) {
  return buildDocumentHtml("quote", quote, admin, quote && quote.customer, branding);
}

function buildInvoiceHtml(invoice, admin, customer, branding) {
  return buildDocumentHtml("invoice", invoice, admin, customer, branding);
}

function buildPurchaseOrderHtml(po, admin, vendor, branding) {
  return buildDocumentHtml("po", po, admin, vendor, branding);
}

function wrapReportHtml(inner, admin, branding) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;position:relative;padding:4px 2px 8px;">
    ${watermarkHtml(branding && branding.logoUrl)}
    <div style="position:relative;z-index:1;">
      ${buildHeaderHtml(admin, branding)}
      ${inner}
      ${signOffHtml(admin, branding || {}, "report")}
      <div style="margin-top:18px;">${buildFooterHtml(admin, branding && branding.logoUrl)}</div>
    </div>
  </div>`;
}

const api = {
  esc,
  formatDate,
  formatDuration,
  formatMoney,
  amountInWords,
  parseTerms,
  companyArabic,
  companyEnglish,
  companyPhone,
  buildHeaderHtml,
  buildFooterHtml,
  buildQuoteHtml,
  buildInvoiceHtml,
  buildPurchaseOrderHtml,
  wrapReportHtml,
  watermarkHtml,
  signOffHtml,
};

export {
  buildQuoteHtml,
  buildInvoiceHtml,
  buildPurchaseOrderHtml,
  buildFooterHtml,
};
