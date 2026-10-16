"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteInvoice, deleteMaster, deletePurchaseOrder, deleteQuote, recordPayment, saveCustomer, saveInvoice, saveMaster, savePayslip, savePurchaseOrder, saveQuote, saveSettings } from "../lib/accounts";

export async function createCustomerAction(formData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  saveCustomer({
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
  const id = saveQuote(payload);
  revalidatePath("/quotes");
  revalidatePath("/");
  redirect(`/quotes/${id}`);
}

export async function deleteQuoteAction(id) {
  deleteQuote(id);
  revalidatePath("/quotes");
  revalidatePath("/");
}

export async function deleteInvoiceAction(id) {
  deleteInvoice(id);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function recordPaymentAction(id, amount) {
  recordPayment(id, amount);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function saveInvoiceAction(payload) {
  const id = saveInvoice(payload);
  revalidatePath("/invoices");
  revalidatePath("/");
  redirect(`/invoices/${id}`);
}

export async function saveMasterAction(kind, payload) {
  const id = saveMaster(kind, payload);
  revalidatePath(`/${kind}`);
  revalidatePath("/");
  return id;
}

export async function deleteMasterAction(kind, id) {
  deleteMaster(kind, id);
  revalidatePath(`/${kind}`);
  revalidatePath("/");
}

export async function savePayslipAction(payload) {
  const id = savePayslip(payload);
  revalidatePath("/payslips");
  revalidatePath("/");
  return id;
}

export async function saveSettingsAction(payload) {
  saveSettings(payload);
  revalidatePath("/settings");
}

export async function savePurchaseOrderAction(payload) {
  const id = savePurchaseOrder(payload);
  revalidatePath("/purchase-orders");
  revalidatePath("/");
  redirect(`/purchase-orders/${id}`);
}

export async function deletePurchaseOrderAction(id) {
  deletePurchaseOrder(id);
  revalidatePath("/purchase-orders");
  revalidatePath("/");
}
