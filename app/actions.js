"use server";

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteStaff, saveStaff, assertPermission } from "../lib/access";
import { deleteCompanyFile, deleteExpense, deleteInvoice, deleteMaster, deletePurchaseOrder, deleteQuote, deleteReceipt, getSettings, recordPayment, saveBrandingPaths, saveCompanyFile, saveCustomer, saveGeneralExpense, saveInvoice, saveMaster, savePayslip, savePurchaseOrder, saveQuote, saveReceipt, saveSettings, saveVehicleExpense } from "../lib/accounts";

async function allow(key) {
  const jar = await cookies();
  await assertPermission(jar.get("almsar_gate")?.value, key);
}

export async function createCustomerAction(formData) {
  await allow("customers");
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await saveCustomer({
    name,
    company: String(formData.get("company") || ""),
    phone: String(formData.get("phone") || ""),
    email: String(formData.get("email") || ""),
    trn: String(formData.get("trn") || ""),
  });
  revalidatePath("/customers");
  revalidatePath("/");
}

export async function saveQuoteAction(payload) {
  await allow("quotes");
  const id = await saveQuote(payload);
  revalidatePath("/quotes");
  revalidatePath("/");
  redirect(`/quotes/${id}?saved=1`);
}

export async function deleteQuoteAction(id) {
  await allow("quotes");
  await deleteQuote(id);
  revalidatePath("/quotes");
  revalidatePath("/");
}

export async function deleteInvoiceAction(id) {
  await allow("invoices");
  await deleteInvoice(id);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function recordPaymentAction(id, amount) {
  await allow("invoices");
  await recordPayment(id, amount);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function saveReceiptAction(formData) {
  await allow("receipts");
  const payload = JSON.parse(String(formData.get("payload") || "{}"));
  let filePath = String(formData.get("filePath") || "");
  if (formData.get("clearFile") === "1") {
    removeReceiptFile(filePath);
    filePath = "";
  }
  const file = formData.get("file");
  if (file && typeof file !== "string" && file.size) {
    removeReceiptFile(filePath);
    filePath = await storeReceiptFile(file);
  }
  const id = await saveReceipt({ ...payload, filePath });
  revalidatePath("/receipts");
  revalidatePath("/invoices");
  revalidatePath("/");
  redirect(`/receipts/${id}?saved=1`);
}

export async function deleteReceiptAction(id) {
  await allow("receipts");
  const filePath = await deleteReceipt(id);
  removeReceiptFile(filePath);
  revalidatePath("/receipts");
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function saveInvoiceAction(payload) {
  await allow("invoices");
  const id = await saveInvoice(payload);
  revalidatePath("/invoices");
  revalidatePath("/");
  redirect(`/invoices/${id}?saved=1`);
}

export async function saveMasterAction(kind, payload) {
  await allow(kind);
  const id = await saveMaster(kind, payload);
  revalidatePath(`/${kind}`);
  revalidatePath("/");
  return id;
}

const OWNERSHIP = path.join(process.cwd(), "data", "ownership");

function removeOwnership(name) {
  if (!name || !/^[\w.-]+$/.test(name)) return;
  const file = path.join(OWNERSHIP, name);
  if (fs.existsSync(file)) fs.rmSync(file);
}

async function storeOwnership(file) {
  if (!file || typeof file === "string" || !file.size) return "";
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("File must be a JPG, PNG, WEBP, or PDF");
  const name = `${randomUUID()}.${ext}`;
  fs.mkdirSync(OWNERSHIP, { recursive: true });
  fs.writeFileSync(path.join(OWNERSHIP, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function saveVehicleAction(formData) {
  await allow("vehicles");
  let ownershipPath = String(formData.get("ownershipPath") || "");
  const file = formData.get("ownership");
  if (formData.get("clearOwnership") === "1") {
    removeOwnership(ownershipPath);
    ownershipPath = "";
  }
  if (file && typeof file !== "string" && file.size) {
    removeOwnership(ownershipPath);
    ownershipPath = await storeOwnership(file);
  }
  const id = await saveMaster("vehicles", {
    id: String(formData.get("id") || ""),
    vehicleNumber: String(formData.get("vehicleNumber") || ""),
    vehicleType: String(formData.get("vehicleType") || ""),
    category: String(formData.get("category") || ""),
    year: String(formData.get("year") || ""),
    notes: String(formData.get("notes") || ""),
    registrationExpiry: String(formData.get("registrationExpiry") || ""),
    ownershipExpiry: String(formData.get("ownershipExpiry") || ""),
    ownershipPath,
  });
  revalidatePath("/vehicles");
  revalidatePath("/vehicle-dashboard");
  revalidatePath("/");
  return id;
}

export async function deleteMasterAction(kind, id) {
  await allow(kind);
  const result = await deleteMaster(kind, id);
  if (result?.error) return result;
  revalidatePath(`/${kind}`);
  revalidatePath("/");
  return result;
}

export async function savePayslipAction(payload) {
  await allow("payslips");
  const id = await savePayslip(payload);
  revalidatePath("/payslips");
  revalidatePath("/");
  return id;
}

export async function saveSettingsAction(payload) {
  await allow("settings");
  await saveSettings(payload);
  revalidatePath("/settings");
}

export async function savePurchaseOrderAction(payload) {
  await allow("orders");
  const id = await savePurchaseOrder(payload);
  revalidatePath("/purchase-orders");
  revalidatePath("/");
  redirect(`/purchase-orders/${id}?saved=1`);
}

export async function deletePurchaseOrderAction(id) {
  await allow("orders");
  await deletePurchaseOrder(id);
  revalidatePath("/purchase-orders");
  revalidatePath("/");
}

const RECEIPTS = path.join(process.cwd(), "data", "receipts");
const RECEIPT_FILES = path.join(process.cwd(), "data", "receipt-files");
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function removeReceipt(name) {
  if (!name || !/^[\w.-]+$/.test(name)) return;
  const file = path.join(RECEIPTS, name);
  if (fs.existsSync(file)) fs.rmSync(file);
}

async function storeReceipt(file) {
  if (!file || typeof file === "string" || !file.size) return "";
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("File must be a JPG, PNG, WEBP, or PDF");
  const name = `${randomUUID()}.${ext}`;
  fs.mkdirSync(RECEIPTS, { recursive: true });
  fs.writeFileSync(path.join(RECEIPTS, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

function removeReceiptFile(name) {
  if (!name || !/^[\w.-]+$/.test(name)) return;
  const file = path.join(RECEIPT_FILES, name);
  if (fs.existsSync(file)) fs.rmSync(file);
}

async function storeReceiptFile(file) {
  if (!file || typeof file === "string" || !file.size) return "";
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("File must be a JPG, PNG, WEBP, or PDF");
  const name = `${randomUUID()}.${ext}`;
  fs.mkdirSync(RECEIPT_FILES, { recursive: true });
  fs.writeFileSync(path.join(RECEIPT_FILES, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function saveExpenseAction(formData) {
  await allow("expenses");
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (!description || amount <= 0) return { error: "required" };
  const kind = String(formData.get("kind") || "vehicle");
  let receiptPath = String(formData.get("receiptPath") || "");
  if (formData.get("clearReceipt") === "1") {
    removeReceipt(receiptPath);
    receiptPath = "";
  }
  const file = formData.get("receipt");
  if (file && typeof file !== "string" && file.size) {
    removeReceipt(receiptPath);
    receiptPath = await storeReceipt(file);
  }
  const input = {
    id: String(formData.get("id") || ""),
    description,
    amount,
    date: String(formData.get("date") || ""),
    category: String(formData.get("category") || "other"),
    notes: String(formData.get("notes") || ""),
    receiptPath,
    vehicleId: String(formData.get("vehicleId") || ""),
  };
  if (kind === "general") await saveGeneralExpense(input);
  else {
    if (!input.vehicleId) return { error: "vehicle" };
    await saveVehicleExpense(input);
  }
  revalidatePath("/expenses");
  revalidatePath("/vehicle-finances");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteExpenseAction(kind, id) {
  await allow("expenses");
  const receipt = await deleteExpense(kind, id);
  removeReceipt(receipt);
  revalidatePath("/expenses");
  revalidatePath("/vehicle-finances");
  revalidatePath("/");
}

const BRANDING = path.join(process.cwd(), "data", "branding");
const COMPANY_FILES = path.join(process.cwd(), "data", "company-files");
const BRAND_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function removeStored(dir, name) {
  if (!name || !/^[\w.-]+$/.test(name)) return;
  const file = path.join(dir, name);
  if (fs.existsSync(file)) fs.rmSync(file);
}

async function storeImage(dir, file) {
  const ext = BRAND_TYPES[file.type];
  if (!ext) throw new Error("File must be a JPG, PNG, or WEBP");
  const name = `${randomUUID()}.${ext}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function saveBrandingAction(formData) {
  await allow("settings");
  const current = await getSettings();
  const next = {
    logoPath: current.logoPath || "",
    sealPath: current.sealPath || "",
    signaturePath: current.signaturePath || "",
  };
  for (const slot of ["logo", "seal", "signature"]) {
    const key = `${slot}Path`;
    if (formData.get(`clear${slot}`) === "1") {
      removeStored(BRANDING, next[key]);
      next[key] = "";
    }
    const file = formData.get(slot);
    if (file && typeof file !== "string" && file.size) {
      removeStored(BRANDING, next[key]);
      next[key] = await storeImage(BRANDING, file);
    }
  }
  await saveBrandingPaths(next);
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function saveCompanyFileAction(formData) {
  await allow("files");
  const title = String(formData.get("title") || "").trim();
  const file = formData.get("file");
  if (!title || !file || typeof file === "string" || !file.size) return { error: "required" };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: "type" };
  const storedName = `${randomUUID()}.${ext}`;
  fs.mkdirSync(COMPANY_FILES, { recursive: true });
  fs.writeFileSync(path.join(COMPANY_FILES, storedName), Buffer.from(await file.arrayBuffer()));
  await saveCompanyFile({
    title,
    category: String(formData.get("category") || "papers"),
    storedName,
    originalName: file.name || storedName,
    notes: String(formData.get("notes") || ""),
  });
  revalidatePath("/files");
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteCompanyFileAction(id) {
  await allow("files");
  const storedName = await deleteCompanyFile(id);
  removeStored(COMPANY_FILES, storedName);
  revalidatePath("/files");
  revalidatePath("/settings");
}

export async function saveStaffAction(payload) {
  await allow("settings");
  try {
    const id = await saveStaff(payload);
    revalidatePath("/settings");
    return { id };
  } catch (error) {
    return { error: error.message || "invalid" };
  }
}

export async function deleteStaffAction(id) {
  await allow("settings");
  const result = await deleteStaff(id);
  revalidatePath("/settings");
  return result;
}
