import { parseEmiratesId } from "./parse-id-text";

function isPdf(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

function contrast(canvas) {
  const ctx = canvas.getContext("2d");
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    const value = gray < 140 ? gray * 0.55 : Math.min(255, (gray - 140) * 1.6 + 140);
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function slice(source, left, top, right, bottom) {
  const x = Math.round(source.width * left);
  const y = Math.round(source.height * top);
  const w = Math.max(1, Math.round(source.width * (right - left)));
  const h = Math.max(1, Math.round(source.height * (bottom - top)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(source, x, y, w, h, 0, 0, w, h);
  return contrast(canvas);
}

async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    const max = 1800;
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    contrast(canvas);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadPdf(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

async function textFromPdf(doc) {
  const parts = [];
  const count = Math.min(doc.numPages, 2);
  for (let i = 1; i <= count; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((item) => item.str || "").join(" "));
  }
  return parts.join("\n");
}

async function pagesFromPdf(doc) {
  const canvases = [];
  const count = Math.min(doc.numPages, 2);
  for (let i = 1; i <= count; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    contrast(canvas);
    canvases.push(canvas);
  }
  return canvases;
}

function mergeId(first, second) {
  if (!first) return second;
  if (!second) return first;
  return {
    employeeId: first.employeeId || second.employeeId,
    name: first.name || second.name,
    idExpiry: first.idExpiry || second.idExpiry,
  };
}

export async function readEmiratesIdPhoto(file) {
  if (!file) return null;
  const pdf = isPdf(file);
  if (!pdf && !String(file.type || "").startsWith("image/")) return null;

  let parsed = null;
  let images = [];
  if (pdf) {
    const doc = await loadPdf(file);
    parsed = parseEmiratesId(await textFromPdf(doc));
    if (parsed?.employeeId && parsed?.name && parsed?.idExpiry) return parsed;
    images = await pagesFromPdf(doc);
  } else {
    images = [await prepareImage(file)];
  }

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const parts = [];
    for (const image of images) {
      for (const piece of [image, slice(image, 0.26, 0.12, 0.98, 0.92), slice(image, 0.28, 0.48, 0.95, 0.95)]) {
        const { data } = await worker.recognize(piece);
        if (data?.text) parts.push(data.text);
      }
    }
    return mergeId(parsed, parseEmiratesId(parts.join("\n")));
  } finally {
    await worker.terminate();
  }
}
