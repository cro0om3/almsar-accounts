"use server";

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteExpense, deleteInvoice, deleteMaster, deletePurchaseOrder, deleteQuote, recordPayment, saveCustomer, saveGeneralExpense, saveInvoice, saveMaster, savePayslip, savePurchaseOrder, saveQuote, saveSettings, saveVehicleExpense } from "../lib/accounts";

export async function createCustomerAction(formData) {
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
  const id = await saveQuote(payload);
  revalidatePath("/quotes");
  revalidatePath("/");
  redirect(`/quotes/${id}`);
}

export async function deleteQuoteAction(id) {
  await deleteQuote(id);
  revalidatePath("/quotes");
  revalidatePath("/");
}

export async function deleteInvoiceAction(id) {
  await deleteInvoice(id);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function recordPaymentAction(id, amount) {
  await recordPayment(id, amount);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function saveInvoiceAction(payload) {
  const id = await saveInvoice(payload);
  revalidatePath("/invoices");
  revalidatePath("/");
  redirect(`/invoices/${id}`);
}

export async function saveMasterAction(kind, payload) {
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
  if (!ext) throw new Error("Receipt must be a JPG, PNG, or WEBP image");
  const name = `${randomUUID()}.${ext}`;
  fs.mkdirSync(OWNERSHIP, { recursive: true });
  fs.writeFileSync(path.join(OWNERSHIP, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function saveVehicleAction(formData) {
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
  const result = await deleteMaster(kind, id);
  if (result?.error) return result;
  revalidatePath(`/${kind}`);
  revalidatePath("/");
  return result;
}

export async function savePayslipAction(payload) {
  const id = await savePayslip(payload);
  revalidatePath("/payslips");
  revalidatePath("/");
  return id;
}

export async function saveSettingsAction(payload) {
  await saveSettings(payload);
  revalidatePath("/settings");
}

export async function savePurchaseOrderAction(payload) {
  const id = await savePurchaseOrder(payload);
  revalidatePath("/purchase-orders");
  revalidatePath("/");
  redirect(`/purchase-orders/${id}`);
}

export async function deletePurchaseOrderAction(id) {
  await deletePurchaseOrder(id);
  revalidatePath("/purchase-orders");
  revalidatePath("/");
}

const RECEIPTS = path.join(process.cwd(), "data", "receipts");
const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function removeReceipt(name) {
  if (!name || !/^[\w.-]+$/.test(name)) return;
  const file = path.join(RECEIPTS, name);
  if (fs.existsSync(file)) fs.rmSync(file);
}

async function storeReceipt(file) {
  if (!file || typeof file === "string" || !file.size) return "";
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Receipt must be a JPG, PNG, or WEBP image");
  const name = `${randomUUID()}.${ext}`;
  fs.mkdirSync(RECEIPTS, { recursive: true });
  fs.writeFileSync(path.join(RECEIPTS, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export async function saveExpenseAction(formData) {
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (!description || amount <= 0) return { error: "required" };
  const kind = String(formData.get("kind") || "vehicle");
  const receiptPath = await storeReceipt(formData.get("receipt"));
  const input = {
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
  const receipt = await deleteExpense(kind, id);
  removeReceipt(receipt);
  revalidatePath("/expenses");
  revalidatePath("/vehicle-finances");
  revalidatePath("/");
}
