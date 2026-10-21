"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { deleteStaff, saveStaff, assertPermission } from "../lib/access";
import { deleteCompanyFile, deleteExpense, deleteInvoice, deleteMaster, deletePurchaseOrder, deleteQuote, deleteReceipt, getEmployee, getSettings, recordPayment, saveBrandingPaths, saveCompanyFile, saveCustomer, saveGeneralExpense, saveInvoice, saveMaster, savePayslip, savePurchaseOrder, saveQuote, saveReceipt, saveSettings, saveVehicleExpense, updateCompanyFile } from "../lib/accounts";
import { deleteObject, putObject } from "../lib/object-store";

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
    await deleteObject("receipt-files", filePath);
    filePath = "";
  }
  const file = formData.get("file");
  if (file && typeof file !== "string" && file.size) {
    await deleteObject("receipt-files", filePath);
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
  await deleteObject("receipt-files", filePath);
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
  try {
    const id = await saveMaster(kind, payload);
    revalidatePath(`/${kind}`);
    revalidatePath("/");
    return id;
  } catch (error) {
    return { error: String(error?.message || "saveFailed") };
  }
}

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

async function storeOwned(folder, file, types = IMAGE_TYPES) {
  if (!file || typeof file === "string" || !file.size) return "";
  const ext = types[file.type];
  if (!ext) throw new Error("File must be a JPG, PNG, WEBP, or PDF");
  const name = `${randomUUID()}.${ext}`;
  await putObject(folder, name, Buffer.from(await file.arrayBuffer()), file.type);
  return name;
}

export async function saveVehicleAction(formData) {
  await allow("vehicles");
  let ownershipPath = String(formData.get("ownershipPath") || "");
  const file = formData.get("ownership");
  if (formData.get("clearOwnership") === "1") {
    await deleteObject("ownership", ownershipPath);
    ownershipPath = "";
  }
  if (file && typeof file !== "string" && file.size) {
    await deleteObject("ownership", ownershipPath);
    ownershipPath = await storeOwned("ownership", file);
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

const EMPLOYEE_FILE_KEYS = ["idPath", "passportPath", "licensePath"];

export async function saveEmployeeAction(formData) {
  await allow("employees");
  const payload = {
    id: String(formData.get("id") || ""),
    name: String(formData.get("name") || ""),
    employeeId: String(formData.get("employeeId") || ""),
    role: String(formData.get("role") || ""),
    paymentType: String(formData.get("paymentType") || ""),
    hourlyRate: String(formData.get("hourlyRate") || ""),
    salary: String(formData.get("salary") || ""),
    overtimeRate: String(formData.get("overtimeRate") || ""),
    bankDetails: String(formData.get("bankDetails") || ""),
    idExpiry: String(formData.get("idExpiry") || "").slice(0, 10),
  };
  for (const key of EMPLOYEE_FILE_KEYS) {
    let filePath = String(formData.get(key) || "");
    if (formData.get(`clear_${key}`) === "1") {
      await deleteObject("employee-files", filePath);
      filePath = "";
    }
    const file = formData.get(`file_${key}`);
    if (file && typeof file !== "string" && file.size) {
      await deleteObject("employee-files", filePath);
      filePath = await storeOwned("employee-files", file);
    }
    payload[key] = filePath;
  }
  try {
    const id = await saveMaster("employees", payload);
    revalidatePath("/employees");
    revalidatePath("/");
    return id;
  } catch (error) {
    return { error: String(error?.message || "saveFailed") };
  }
}

export async function deleteMasterAction(kind, id) {
  await allow(kind);
  const employee = kind === "employees" ? await getEmployee(id) : null;
  const result = await deleteMaster(kind, id);
  if (result?.error) return result;
  if (employee) {
    for (const key of EMPLOYEE_FILE_KEYS) {
      await deleteObject("employee-files", employee[key]);
    }
  }
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

async function storeReceipt(file) {
  return storeOwned("receipts", file);
}

async function storeReceiptFile(file) {
  return storeOwned("receipt-files", file);
}

export async function saveExpenseAction(formData) {
  await allow("expenses");
  const description = String(formData.get("description") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  if (!description || amount <= 0) return { error: "required" };
  const kind = String(formData.get("kind") || "vehicle");
  let receiptPath = String(formData.get("receiptPath") || "");
  if (formData.get("clearReceipt") === "1") {
    await deleteObject("receipts", receiptPath);
    receiptPath = "";
  }
  const file = formData.get("receipt");
  if (file && typeof file !== "string" && file.size) {
    await deleteObject("receipts", receiptPath);
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
  await deleteObject("receipts", receipt);
  revalidatePath("/expenses");
  revalidatePath("/vehicle-finances");
  revalidatePath("/");
}

const BRAND_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

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
      await deleteObject("branding", next[key]);
      next[key] = "";
    }
    const file = formData.get(slot);
    if (file && typeof file !== "string" && file.size) {
      await deleteObject("branding", next[key]);
      next[key] = await storeOwned("branding", file, BRAND_TYPES);
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
  await putObject("company-files", storedName, Buffer.from(await file.arrayBuffer()), file.type);
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

export async function updateCompanyFileAction(formData) {
  await allow("files");
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  if (!id || !title) return { error: "required" };
  await updateCompanyFile(id, {
    title,
    category: String(formData.get("category") || "other"),
    notes: String(formData.get("notes") || ""),
  });
  revalidatePath("/files");
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteCompanyFileAction(id) {
  await allow("files");
  const storedName = await deleteCompanyFile(id);
  await deleteObject("company-files", storedName);
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
