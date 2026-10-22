import { parseEmiratesId } from "./parse-id-text";
import { parseVehicleLicense, sideOf } from "./parse-vehicle-text";

function isPdf(file) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "");
}

function isImage(file) {
  return String(file?.type || "").startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file?.name || "");
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

function slice(source, left, top, right, bottom, ink = true) {
  const x = Math.round(source.width * left);
  const y = Math.round(source.height * top);
  const w = Math.max(1, Math.round(source.width * (right - left)));
  const h = Math.max(1, Math.round(source.height * (bottom - top)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(source, x, y, w, h, 0, 0, w, h);
  return ink ? contrast(canvas) : canvas;
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

async function pagesFromPdf(doc, { scale = 2.2, enhance = true } = {}) {
  const canvases = [];
  const count = Math.min(doc.numPages, 2);
  for (let i = 1; i <= count; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    if (enhance) contrast(canvas);
    canvases.push(canvas);
  }
  return canvases;
}

function copyRect(source, x, y, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  canvas.getContext("2d").drawImage(source, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function trimInk(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      if (gray < 248) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return canvas;
  const padX = Math.round(width * 0.01);
  const padY = Math.round(height * 0.01);
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(width - 1, maxX + padX);
  maxY = Math.min(height - 1, maxY + padY);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (w * h > 0.9 * width * height) return canvas;
  return copyRect(canvas, minX, minY, w, h);
}

function splitCards(page) {
  const card = trimInk(page);
  const ratio = card.width / card.height;
  if (ratio >= 1.2 && ratio <= 1.9) return [card];
  if (card.height > card.width * 1.1) {
    const mid = Math.round(card.height / 2);
    return [trimInk(copyRect(card, 0, 0, card.width, mid)), trimInk(copyRect(card, 0, mid, card.width, card.height - mid))];
  }
  if (ratio > 1.9) {
    const mid = Math.round(card.width / 2);
    return [trimInk(copyRect(card, 0, 0, mid, card.height)), trimInk(copyRect(card, mid, 0, card.width - mid, card.height))];
  }
  return [card];
}

function prepMrz(source) {
  const band = slice(source, 0.02, 0.66, 0.98, 0.995, false);
  const canvas = document.createElement("canvas");
  canvas.width = band.width * 2;
  canvas.height = band.height * 2;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(band, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    const value = gray < 150 ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function mergeVehicle(first, second) {
  if (!first) return second;
  if (!second) return first;
  return {
    vehicleNumber: first.vehicleNumber || second.vehicleNumber,
    category: first.category || second.category,
    ownershipExpiry: first.ownershipExpiry || second.ownershipExpiry,
    insuranceExpiry: first.insuranceExpiry || second.insuranceExpiry,
    vehicleType: first.vehicleType || second.vehicleType,
    year: first.year || second.year,
    chassisNumber: first.chassisNumber || second.chassisNumber,
  };
}

function canvasToFile(canvas, name) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("image"));
        return;
      }
      resolve(new File([blob], name, { type: "image/jpeg" }));
    }, "image/jpeg", 0.88);
  });
}

async function ocrVehicleImages(images) {
  const { createWorker } = await import("tesseract.js");
  let worker;
  try {
    worker = await createWorker("eng+ara");
  } catch {
    worker = await createWorker("eng");
  }
  try {
    const parts = [];
    for (const image of images) {
      const pieces = [
        image,
        slice(image, 0.08, 0.18, 0.95, 0.92),
        slice(image, 0.12, 0.58, 0.78, 0.82),
        slice(image, 0.16, 0.38, 0.72, 0.56),
      ];
      for (const piece of pieces) {
        const { data } = await worker.recognize(piece);
        if (data?.text) parts.push(data.text);
      }
    }
    await worker.setParameters({ tessedit_char_whitelist: "0123456789/" });
    for (const image of images) {
      const { data } = await worker.recognize(slice(image, 0.22, 0.22, 0.72, 0.38, false));
      if (data?.text) parts.push(data.text);
    }
    await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
    for (const image of images) {
      const { data } = await worker.recognize(slice(image, 0.16, 0.16, 0.5, 0.32, false));
      if (data?.text) parts.push(data.text);
    }
    await worker.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" });
    for (const image of images) {
      const { data } = await worker.recognize(slice(image, 0.22, 0.62, 0.82, 0.82, false));
      if (data?.text) parts.push(data.text);
    }
    return parts.join("\n");
  } finally {
    await worker.terminate();
  }
}

function placeSide(placed, file, parsed) {
  const side = sideOf(parsed);
  if (side === "back") placed.back = placed.back || file;
  else if (side === "front") placed.front = placed.front || file;
}

async function ocrImages(images, crops) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const regions = crops || [[0.26, 0.12, 0.98, 0.92], [0.28, 0.48, 0.95, 0.95]];
  try {
    const parts = [];
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: "6",
    });
    for (const image of images) {
      const { data } = await worker.recognize(prepMrz(image));
      if (data?.text) parts.push(data.text);
    }
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789-",
      tessedit_pageseg_mode: "7",
    });
    for (const image of images) {
      const { data } = await worker.recognize(slice(image, 0.22, 0.26, 0.78, 0.46, true));
      if (data?.text) parts.push(data.text);
    }
    await worker.setParameters({
      tessedit_char_whitelist: "",
      tessedit_pageseg_mode: "3",
    });
    for (const image of images) {
      const pieces = [image, ...regions.map((box) => slice(image, ...box))];
      for (const piece of pieces) {
        const { data } = await worker.recognize(piece);
        if (data?.text) parts.push(data.text);
      }
    }
    return parts.join("\n");
  } finally {
    await worker.terminate();
  }
}

export async function readEmiratesIdPhoto(file) {
  if (!file) return null;
  const pdf = isPdf(file);
  if (!pdf && !isImage(file)) return null;

  let pdfText = "";
  let images = [];
  if (pdf) {
    const doc = await loadPdf(file);
    pdfText = await textFromPdf(doc);
    const pages = await pagesFromPdf(doc, { scale: 3.2, enhance: false });
    images = pages.flatMap(splitCards);
  } else {
    images = [await prepareImage(file)];
  }
  const ocrText = await ocrImages(images);
  return parseEmiratesId([pdfText, ocrText].filter(Boolean).join("\n"));
}

export async function readVehicleOwnership(files) {
  const list = [...(files || [])].filter(Boolean).slice(0, 2);
  if (!list.length) return null;
  let parsed = null;
  const placed = { front: null, back: null };
  const leftovers = [];

  for (const file of list) {
    if (isPdf(file)) {
      const doc = await loadPdf(file);
      parsed = mergeVehicle(parsed, parseVehicleLicense(await textFromPdf(doc)));
      const pages = await pagesFromPdf(doc);
      const pageFiles = [];
      for (let i = 0; i < pages.length; i += 1) {
        const pageFile = await canvasToFile(pages[i], i === 0 ? "ownership-front.jpg" : "ownership-back.jpg");
        pageFiles.push(pageFile);
        const pageParsed = parseVehicleLicense(await ocrVehicleImages([pages[i]]));
        parsed = mergeVehicle(parsed, pageParsed);
        placeSide(placed, pageFile, pageParsed);
      }
      if (pageFiles.length === 2) {
        placed.front = placed.front || pageFiles[0];
        placed.back = placed.back || pageFiles[1];
      } else if (pageFiles[0] && !placed.front && !placed.back) {
        leftovers.push(pageFiles[0]);
      }
    } else if (isImage(file)) {
      leftovers.push(file);
      const pageParsed = parseVehicleLicense(await ocrVehicleImages([await prepareImage(file)]));
      parsed = mergeVehicle(parsed, pageParsed);
      placeSide(placed, file, pageParsed);
    }
  }

  if (leftovers.length === 2) {
    if (placed.front && !placed.back) placed.back = leftovers.find((file) => file !== placed.front) || leftovers[1];
    else if (placed.back && !placed.front) placed.front = leftovers.find((file) => file !== placed.back) || leftovers[0];
    else if (!placed.front && !placed.back) {
      placed.front = leftovers[0];
      placed.back = leftovers[1];
    }
  } else if (leftovers.length === 1 && !placed.front && !placed.back) {
    placed.front = leftovers[0];
  }

  if (!parsed) return null;
  return { ...parsed, frontFile: placed.front, backFile: placed.back };
}
