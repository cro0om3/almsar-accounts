import { wrapReportHtml } from "./letterhead";

function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileName(id, ext) {
  const key = String(id || "report")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  return `Report_${key}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

function sheetValue(column, value) {
  if (value === "" || value == null) return "";
  if (column.kind === "money" || column.kind === "number") return Number(value) || 0;
  return value;
}

export async function downloadReportExcel({ id, title, company, period, report }) {
  const XLSX = await import("xlsx");
  const data = [
    [company || ""],
    [title],
    [period],
    [],
    report.kpis.map((item) => item.label),
    report.kpis.map((item) => (item.money ? Number(item.value) || 0 : item.value)),
    [],
    report.columns.map((column) => column.label),
    ...report.rows.map((row) => row.map((value, index) => sheetValue(report.columns[index], value))),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = report.columns.map((column) => ({ wch: column.kind === "text" ? 28 : 16 }));
  const book = XLSX.utils.book_new();
  const name = String(title || "Report").replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Report";
  XLSX.utils.book_append_sheet(book, sheet, name);
  XLSX.writeFile(book, fileName(id, "xlsx"));
}

function moneyText(value) {
  return Number(value || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function display(column, value) {
  if (value === "" || value == null) return "";
  if (column.kind === "money") return moneyText(value);
  return String(value);
}

function reportHtml(title, period, report) {
  const th = "border:1px solid #111;padding:6px 8px;font-size:11px;font-weight:700;";
  const td = "border:1px solid #111;padding:6px 8px;font-size:11px;vertical-align:top;";
  const head = report.columns.map((column) => (
    `<th style="${th}text-align:${column.kind === "text" ? "center" : "right"};">${esc(column.label)}</th>`
  )).join("");
  const body = report.rows.map((row) => (
    `<tr>${row.map((value, index) => {
      const numeric = report.columns[index]?.kind !== "text";
      return `<td style="${td}text-align:${numeric ? "right" : "left"};${numeric ? "white-space:nowrap;" : "overflow-wrap:break-word;"}">${esc(display(report.columns[index], value))}</td>`;
    }).join("")}</tr>`
  )).join("");
  const kpis = report.kpis.map((item) => (
    `<div style="min-width:140px;padding:8px 12px;border:1px solid #111;margin:0 8px 8px 0;">
      <div style="font-size:16px;font-weight:bold;">${esc(item.money ? moneyText(item.value) : item.value)}</div>
      <div style="font-size:11px;color:#555;">${esc(item.label)}</div>
    </div>`
  )).join("");
  const span = report.columns.length || 1;
  return `<h2 style="text-align:center;margin:8px 0 4px;font-size:18px;text-decoration:underline;">${esc(title)}</h2>
    <p style="text-align:center;margin:0 0 12px;font-size:12px;"><strong>${esc(period)}</strong></p>
    <div style="display:flex;flex-wrap:wrap;margin-bottom:12px;">${kpis}</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px;">
      <thead><tr>${head}</tr></thead>
      <tbody>${body || `<tr><td colspan="${span}" style="${td}">—</td></tr>`}</tbody>
    </table>`;
}

function preload(src) {
  return new Promise((resolve) => {
    if (!src) return resolve();
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

function paint(pdf, canvas) {
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableW = width - margin * 2;
  const usableH = height - margin * 2;
  const imageHeight = (canvas.height * usableW) / canvas.width;
  if (imageHeight <= usableH * 1.2) {
    const fitH = Math.min(imageHeight, usableH);
    const fitW = (canvas.width * fitH) / canvas.height;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin + (usableW - fitW) / 2, margin, fitW, fitH);
    return;
  }
  const pagePx = Math.floor((usableH * canvas.width) / usableW);
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
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, usableW, (sliceH * usableW) / canvas.width);
    first = false;
    y += sliceH;
  }
}

async function companyProfile(fallback) {
  try {
    const response = await fetch("/api/company");
    if (response.ok) return await response.json();
  } catch {
    /* The report still prints with the saved company name. */
  }
  return {
    admin: fallback || {},
    branding: {
      logoUrl: `${location.origin}/api/branding/logo`,
      sealUrl: `${location.origin}/api/branding/seal`,
      signatureUrl: `${location.origin}/api/branding/signature`,
    },
  };
}

export async function downloadReportPdf({ id, title, period, report, settings }) {
  const { jsPDF } = await import("jspdf");
  const html2canvas = (await import("html2canvas")).default;
  const profile = await companyProfile(settings);
  const branding = profile.branding || {};
  await Promise.all([preload(branding.logoUrl), preload(branding.sealUrl), preload(branding.signatureUrl), preload("/ic-check.png")]);
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "297mm";
  container.style.background = "#fff";
  container.innerHTML = wrapReportHtml(reportHtml(title, period, report), profile.admin || settings || {}, branding);
  document.body.appendChild(container);
  try {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      allowTaint: true,
    });
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    paint(pdf, canvas);
    pdf.save(fileName(id, "pdf"));
  } finally {
    container.remove();
  }
}
