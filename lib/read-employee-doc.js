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
    color: first.color || second.color,
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
  return mergeId(parsed, parseEmiratesId(await ocrImages(images)));
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
