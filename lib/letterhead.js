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
  const cell = "border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;vertical-align:middle;background:#fff;line-height:1.3;";
  return `<tr>
    <td style="${cell}font-weight:700;white-space:nowrap;width:38%;">${esc(label)}</td>
    <td style="${cell}">${esc(value)}</td>
  </tr>`;
}

function infoTable(title, rows) {
  return `<table style="width:100%;border-collapse:collapse;border:1px solid #e3e7ee;">
    <thead><tr><th colspan="2" style="border:1px solid #e3e7ee;padding:5px 8px;font-size:11px;font-weight:700;text-align:center;background:#f6f7f9;">${esc(title)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildHeaderHtml(admin, branding) {
  const logoUrl = branding && branding.logoUrl;
  const logo = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="" style="width:210px;max-width:46%;height:auto;object-fit:contain;display:block;margin-left:-17px;" />`
    : "";
  return `<div style="position:relative;display:flex;align-items:center;gap:16px;padding:0 64px 8px 0;border-bottom:2.5px solid #111;margin-bottom:8px;">
    ${logo}
    <div style="flex:1;text-align:center;">
      <div dir="rtl" style="font-size:18px;font-weight:800;line-height:1.4;">${esc(companyArabic(admin))}</div>
      <div style="font-size:16px;font-weight:800;letter-spacing:.3px;margin-top:2px;">ALMSAR ALZAKI TRANSPORT AND MAINTENANCE</div>
    </div>
    <img src="/ic-check.png" alt="" style="position:absolute;top:50%;right:0;transform:translateY(-58%);height:40px;width:auto;object-fit:contain;" />
  </div>`;
}

function buildFooterHtml(admin) {
  const branch = (admin && (admin.footerAddressEnglish || splitAddress(admin.address).place) || "").trim();
  const phone = companyPhone(admin);
  let email = (admin && (admin.email || admin.companyEmail) || "").trim();
  if (!email || /almsar\.uae@gmail\.com/i.test(email)) email = "info@almsaralzaki.com";
  let website = (admin && admin.website || "almsaralzaki.com").trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (website && !/^www\./i.test(website)) website = `www.${website}`;
  const bits = [branch, phone, email, website].filter(Boolean).map((bit) => `<span>${esc(bit)}</span>`).join("");
  return `<div style="margin-top:6px;page-break-inside:avoid;break-inside:avoid;text-align:center;font-size:11px;font-weight:700;line-height:1.35;color:#1e3a5f;">
    <div style="letter-spacing:.2px;margin:0 0 6px;">ISO 9001:2015 | ISO 14001:2015 | ISO 45001:2018</div>
    <div style="border-top:2.5px solid #111;padding-top:8px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">${bits}</div>
  </div>`;
}

function watermarkHtml() {
  return "";
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
  const th = "border:1px solid #e3e7ee;padding:4px 5px;font-size:10px;font-weight:700;text-align:center;background:#f6f7f9;color:#111;vertical-align:middle;";
  const td = "border:1px solid #e3e7ee;padding:4px 5px;font-size:11px;vertical-align:middle;line-height:1.3;background:#fff;";
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
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;margin:14px 0 12px;border:1px solid #e3e7ee;">
    <colgroup>
      <col style="width:5%"><col style="width:30%"><col style="width:6%"><col style="width:10%">
      <col style="width:11%"><col style="width:8%"><col style="width:11%"><col style="width:8%"><col style="width:11%">
    </colgroup>
    <thead><tr>
      <th style="${th}">#</th>
      <th style="${th}text-align:left;padding-left:12px;">Item Description</th>
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
      <td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;line-height:1.35;vertical-align:middle;background:#fff;"><strong style="margin-right:6px;">${num}.</strong>${esc(t)}</td>
    </tr>`;
  }).join("");
  return `<table style="width:100%;border-collapse:collapse;margin-top:8px;border:1px solid #e3e7ee;">
    <thead><tr><th style="border:1px solid #e3e7ee;padding:5px 8px;font-size:11px;font-weight:700;text-align:center;background:#f6f7f9;">${esc(title)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function signOffHtml(admin, branding, kind) {
  const sealUrl = branding && branding.sealUrl;
  const signatureUrl = branding && branding.signatureUrl;
  let stamp = "";
  if (sealUrl && signatureUrl) {
    stamp = `<div style="position:relative;width:140px;height:112px;">
      <img src="${esc(sealUrl)}" style="height:104px;width:104px;object-fit:contain;position:absolute;left:0;top:4px;" />
      <img src="${esc(signatureUrl)}" style="height:54px;object-fit:contain;position:absolute;left:36px;top:50px;" />
    </div>`;
  } else if (sealUrl) {
    stamp = `<img src="${esc(sealUrl)}" style="height:104px;width:104px;object-fit:contain;" />`;
  } else if (signatureUrl) {
    stamp = `<img src="${esc(signatureUrl)}" style="height:54px;object-fit:contain;" />`;
  } else {
    stamp = `<div style="height:112px;"></div>`;
  }
  const boxLabel = kind === "invoice"
    ? "Signing here implies acceptance of this tax invoice"
    : kind === "receipt"
      ? "Signing here acknowledges receipt of this payment"
      : "Signing here implies the hirer's acceptance of the above terms & conditions";
  return `<div style="margin-top:auto;padding-top:10px;">
    <div style="margin-bottom:2px;">Thanking You,</div>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;margin-bottom:4px;">${esc(companyEnglish(admin))}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;">
      <div style="width:200px;text-align:center;">
        <div style="height:112px;display:flex;align-items:center;justify-content:center;">${stamp}</div>
        <div style="margin-top:4px;font-size:12px;font-weight:700;">Authorised Signatory</div>
      </div>
      <div style="width:250px;text-align:center;">
        <div style="box-sizing:border-box;border:1px solid #111;height:112px;padding:8px;font-size:10px;color:#111;text-align:left;">${esc(boxLabel)}</div>
        <div style="margin-top:6px;font-size:12px;font-weight:700;">(Approval By Customer)</div>
        <div style="font-size:12px;font-weight:700;">Authorised Signatory</div>
      </div>
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
  const subTotal = doc.subTotal ?? doc.subtotal ?? 0;
  const tax = doc.totalTax ?? doc.tax ?? 0;
  const total = doc.total ?? doc.amount ?? 0;
  const items = doc.items || [];
  const salesPerson = doc.salesPerson || doc.salesPersonName || "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;position:relative;padding:0;display:flex;flex-direction:column;flex:1;">
    ${watermarkHtml()}
    <div style="position:relative;z-index:1;display:flex;flex-direction:column;flex:1;">
      ${buildHeaderHtml(admin, branding)}
      ${titleHtml}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:4px 0 8px;">
        <div style="flex:1;">
          ${infoTable("Document Information", [
            infoRow(numberLabel, doc.number),
            infoRow(dateLabel, formatDate(doc.date)),
            extraLabel ? infoRow(extraLabel, extraValue ? formatDate(extraValue) : "-") : "",
            salesPerson ? infoRow("Sales Person:", salesPerson) : "",
            infoRow("Address:", place),
            isInvoice ? infoRow("Duration:", formatDuration(doc.duration) || "-") : "",
          ].join(""))}
        </div>
        <div style="flex:1;">
          ${infoTable(isPo ? "Vendor Information" : "Customer Information", [
            infoRow("Name:", partyName),
            infoRow("Address:", partyAddr),
            infoRow("VAT No:", partyVat),
            infoRow("Phone:", partyPhone),
          ].join(""))}
        </div>
      </div>
      <p style="margin:0 0 6px;font-size:12px;"><strong>Subject:</strong> ${esc(subject)}</p>
      <p style="margin:0 0 2px;font-size:12px;">Dear Sir,</p>
      <p style="margin:0 0 8px;font-size:12px;">${esc(intro)}</p>
      ${letterItemsTable(items)}
      <table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #e3e7ee;">
        <tbody>
          <tr>
            <td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;font-weight:700;text-align:right;background:#fff;">Sub Total (In ${esc(currency)})</td>
            <td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;text-align:right;background:#fff;width:140px;">${formatMoney(subTotal)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;font-weight:700;text-align:right;background:#fff;">Total Vat Amount (In ${esc(currency)})</td>
            <td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;text-align:right;background:#fff;">${formatMoney(tax)}</td>
          </tr>
          <tr>
            <td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;font-weight:700;text-align:right;background:#f6f7f9;">Grand Total (In ${esc(currency)})</td>
            <td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;font-weight:700;text-align:right;background:#f6f7f9;">${formatMoney(total)}</td>
          </tr>
          <tr>
            <td colspan="2" style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;text-align:center;background:#fff;"><strong>Grand Total (in words):</strong> ${esc(currency)} : ${esc(amountInWords(total, currency))}</td>
          </tr>
        </tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #e3e7ee;">
        <thead><tr><th style="border:1px solid #e3e7ee;padding:5px 8px;font-size:11px;font-weight:700;text-align:center;background:#f6f7f9;">Payment Terms</th></tr></thead>
        <tbody><tr><td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;line-height:1.35;background:#fff;">${esc(payment)}</td></tr></tbody>
      </table>
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

function buildReceiptHtml(doc, admin, customer, branding) {
  const party = customer || (doc && doc.customer) || {};
  const partyName = party.company || party.name || "-";
  const partyAddr = party.address || "-";
  const partyVat = party.trn || party.vatNumber || "-";
  const partyPhone = party.phone || "-";
  const methods = { cash: "Cash", transfer: "Bank transfer", cheque: "Cheque", card: "Card" };
  const method = methods[doc && doc.method] || (doc && doc.method) || "-";
  const lines = doc && Array.isArray(doc.allocations) && doc.allocations.length
    ? doc.allocations
    : [{ invoiceNumber: (doc && doc.invoiceNumber) || "-", amount: doc && doc.amount }];
  const amount = Number(doc && doc.amount) || lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const note = String((doc && doc.notes) || "").replace(/<[^>]+>/g, "").trim();
  const th = "border:1px solid #e3e7ee;padding:4px 5px;font-size:10px;font-weight:700;text-align:center;background:#f6f7f9;color:#111;vertical-align:middle;";
  const td = "border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;vertical-align:middle;line-height:1.3;background:#fff;";
  const rows = lines.map((line, index) => `<tr>
      <td style="${td}text-align:center;width:48px;">${index + 1}</td>
      <td style="${td}">${esc(line.invoiceNumber || "-")}</td>
      <td style="${td}text-align:right;width:140px;">${formatMoney(line.amount)}</td>
    </tr>`).join("");
  const addr = splitAddress(admin && admin.address);
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;position:relative;padding:0;display:flex;flex-direction:column;flex:1;">
    ${watermarkHtml()}
    <div style="position:relative;z-index:1;display:flex;flex-direction:column;flex:1;">
      ${buildHeaderHtml(admin, branding)}
      <h2 style="text-align:center;margin:4px 0 8px;font-size:18px;letter-spacing:.5px;text-decoration:underline;">RECEIPT</h2>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:4px 0 8px;">
        <div style="flex:1;">
          ${infoTable("Receipt Information", [
            infoRow("Receipt:", doc && doc.number),
            infoRow("Date:", formatDate(doc && doc.date)),
            infoRow("Method:", method),
            infoRow("Reference:", (doc && doc.reference) || "-"),
            infoRow("Address:", addr.place || "Abu Dhabi"),
          ].join(""))}
        </div>
        <div style="flex:1;">
          ${infoTable("Customer Information", [
            infoRow("Name:", partyName),
            infoRow("Address:", partyAddr),
            infoRow("VAT No:", partyVat),
            infoRow("Phone:", partyPhone),
          ].join(""))}
        </div>
      </div>
      <p style="margin:0 0 8px;font-size:12px;">We acknowledge receipt of the following payment.</p>
      <table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #e3e7ee;">
        <thead><tr>
          <th style="${th}width:48px;">#</th>
          <th style="${th}text-align:left;padding-left:8px;">Invoice</th>
          <th style="${th}">Amount (AED)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #e3e7ee;">
        <tbody>
          <tr>
            <td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;font-weight:700;text-align:right;background:#f6f7f9;">Amount Received (In AED)</td>
            <td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;font-weight:700;text-align:right;background:#f6f7f9;width:140px;">${formatMoney(amount)}</td>
          </tr>
          <tr>
            <td colspan="2" style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;text-align:center;background:#fff;"><strong>Amount in words:</strong> AED : ${esc(amountInWords(amount, "AED"))}</td>
          </tr>
        </tbody>
      </table>
      ${note ? `<table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #e3e7ee;">
        <thead><tr><th style="border:1px solid #e3e7ee;padding:5px 8px;font-size:11px;font-weight:700;text-align:center;background:#f6f7f9;">Being Payment For</th></tr></thead>
        <tbody><tr><td style="border:1px solid #e3e7ee;padding:4px 8px;font-size:11px;line-height:1.35;background:#fff;">${esc(note)}</td></tr></tbody>
      </table>` : ""}
      ${signOffHtml(admin, branding || {}, "receipt")}
    </div>
  </div>`;
}

function wrapReportHtml(inner, admin, branding) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;position:relative;padding:4px 2px 8px;">
    ${watermarkHtml()}
    <div style="position:relative;z-index:1;">
      ${buildHeaderHtml(admin, branding)}
      ${inner}
      ${signOffHtml(admin, branding || {}, "report")}
      <div style="margin-top:18px;">${buildFooterHtml(admin)}</div>
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
  buildReceiptHtml,
  wrapReportHtml,
  watermarkHtml,
  signOffHtml,
};

export {
  buildQuoteHtml,
  buildInvoiceHtml,
  buildPurchaseOrderHtml,
  buildReceiptHtml,
  buildFooterHtml,
};
