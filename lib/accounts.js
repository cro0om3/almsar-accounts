import { randomUUID } from "crypto";
import { all, get, nextNumber, run } from "./local-db";
import { recomputeLine, summarize } from "./money";

function customerName(id) {
  if (!id) return "";
  return get("select name from customers where id = ?", [id])?.name || "";
}

export function dashboard() {
  const month = new Date().toISOString().slice(0, 7);
  const invoices = all("select id, number, date, total, amountReceived, status, customerId, createdAt from invoices");
  const quotes = all("select id, number, date, total, customerId, createdAt from quotes");
  const customers = all("select id, name, createdAt from customers");
  const billed = invoices.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const received = invoices.reduce((sum, row) => sum + (Number(row.amountReceived) || 0), 0);
  const quoteValue = quotes.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const inMonth = (row) => String(row.date || row.createdAt || "").startsWith(month);
  let revenue = 0;
  let expenses = 0;
  try {
    const tx = all("select transactionType, amount from vehicle_transactions");
    for (const row of tx) {
      if (row.transactionType === "expense") expenses += Number(row.amount) || 0;
      else revenue += Number(row.amount) || 0;
    }
  } catch {
    revenue = billed;
  }
  if (!revenue) revenue = billed;
  const names = Object.fromEntries(customers.map((row) => [row.id, row.name]));
  const byCustomer = new Map();
  for (const row of invoices) {
    const key = row.customerId || "";
    const current = byCustomer.get(key) || { name: names[key] || "—", invoices: 0, quotes: 0, total: 0, outstanding: 0 };
    current.invoices += 1;
    current.total += Number(row.total) || 0;
    current.outstanding += (Number(row.total) || 0) - (Number(row.amountReceived) || 0);
    byCustomer.set(key, current);
  }
  for (const row of quotes) {
    const key = row.customerId || "";
    const current = byCustomer.get(key) || { name: names[key] || "—", invoices: 0, quotes: 0, total: 0, outstanding: 0 };
    current.quotes += 1;
    byCustomer.set(key, current);
  }
  const topCustomers = [...byCustomer.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  const activity = [
    ...quotes.map((row) => ({
      kind: "quote",
      text: row.number,
      customer: names[row.customerId] || "",
      total: row.total,
      at: row.createdAt || row.date,
    })),
    ...customers.map((row) => ({
      kind: "customer",
      text: row.name,
      at: row.createdAt,
    })),
  ]
    .filter((row) => row.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 6);
  return {
    customers: customers.length,
    vehicles: get("select count(*) as c from vehicles").c,
    employees: get("select count(*) as c from employees").c,
    quotes: quotes.length,
    quotesMonth: quotes.filter(inMonth).length,
    quoteValue,
    quoteValueMonth: quotes.filter(inMonth).reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    invoices: invoices.length,
    invoicesMonth: invoices.filter(inMonth).length,
    billed,
    received,
    receivedMonth: invoices.filter(inMonth).reduce((sum, row) => sum + (Number(row.amountReceived) || 0), 0),
    pending: invoices.filter((row) => (Number(row.amountReceived) || 0) < (Number(row.total) || 0)).length,
    outstanding: billed - received,
    revenue,
    expenses,
    profit: revenue - expenses,
    topCustomers,
    activity,
    recent: invoices
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8)
      .map((row) => ({ ...row, customerName: names[row.customerId] || "" })),
  };
}

export function listCustomers() {
  return all("select * from customers order by name");
}

export function saveCustomer(input) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const existing = get("select id from customers where id = ?", [id]);
  if (existing) {
    run(
      `update customers set name=?, company=?, email=?, phone=?, address=?, trn=?, updatedAt=? where id=?`,
      [input.name, input.company || "", input.email || "", input.phone || "", input.address || "", input.trn || "", now, id]
    );
  } else {
    run(
      `insert into customers (id, name, company, email, phone, address, trn, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.name, input.company || "", input.email || "", input.phone || "", input.address || "", input.trn || "", now, now]
    );
  }
  return id;
}

export function listVehicles() {
  return all("select * from vehicles order by vehicleNumber");
}

export function listVendors() {
  return all("select * from vendors order by name");
}

export function listEmployees() {
  return all("select * from employees order by name");
}

export function listQuotes() {
  return all(`
    select q.*, c.name as customerName
    from quotes q
    left join customers c on c.id = q.customerId
    order by q.createdAt desc
  `);
}

export function listInvoices() {
  return all(`
    select i.*, c.name as customerName
    from invoices i
    left join customers c on c.id = i.customerId
    order by i.createdAt desc
  `);
}

function customerRecord(id) {
  if (!id) return null;
  return get("select id, name, company, email, phone, address, trn from customers where id = ?", [id]);
}

export function quotesForDesk() {
  return listQuotes().map((row) => ({
    ...getQuote(row.id),
    customer: customerRecord(row.customerId),
  }));
}

export function invoicesForDesk() {
  return listInvoices().map((row) => ({
    ...getInvoice(row.id),
    customer: customerRecord(row.customerId),
  }));
}

export function financesForDesk() {
  let transactions = [];
  try {
    transactions = all("select * from vehicle_transactions");
  } catch {
    transactions = [];
  }
  return listVehicles().map((vehicle) => {
    const rows = transactions.filter((row) => row.vehicleId === vehicle.id);
    const revenue = rows
      .filter((row) => row.transactionType !== "expense")
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    const expenses = rows
      .filter((row) => row.transactionType === "expense")
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return {
      id: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber || "",
      vehicleType: vehicle.vehicleType || "",
      status: vehicle.status || "active",
      revenue,
      expenses,
      profit: revenue - expenses,
      transactions: rows.map((row) => ({
        id: row.id,
        date: row.date,
        transactionType: row.transactionType,
        amount: row.amount,
        description: row.description || "",
      })),
    };
  });
}

export function deleteQuote(id) {
  run("delete from quote_items where quoteId = ?", [id]);
  run("delete from quotes where id = ?", [id]);
}

export function deleteInvoice(id) {
  run("delete from invoice_items where invoiceId = ?", [id]);
  run("delete from invoices where id = ?", [id]);
}

export function recordPayment(id, amount) {
  const invoice = get("select total from invoices where id = ?", [id]);
  if (!invoice) return;
  const received = Number(amount) || 0;
  const status = received >= Number(invoice.total || 0) ? "payment_received" : "invoice_sent";
  run("update invoices set amountReceived = ?, status = ?, updatedAt = ? where id = ?", [
    received,
    status,
    new Date().toISOString(),
    id,
  ]);
}

export function listPurchaseOrders() {
  return all(`
    select p.*, v.name as vendorName
    from purchase_orders p
    left join vendors v on v.id = p.vendorId
    order by p.createdAt desc
  `);
}

function mapItem(row) {
  return {
    id: row.id,
    vehicleTypeId: row.vehicleTypeId || "",
    vehicleTypeLabel: row.vehicleTypeLabel || "",
    vehicleNumber: row.vehicleNumber || "",
    description: row.description || "",
    rentalBasis: row.rentalBasis || "",
    quantity: row.quantity || 0,
    unitPrice: row.unitPrice || 0,
    taxPercent: row.taxPercent || 0,
    grossAmount: row.grossAmount || 0,
    lineTaxAmount: row.lineTaxAmount || 0,
    lineTotal: row.lineTotal || 0,
    amountReceived: row.amountReceived || 0,
  };
}

export function getQuote(id) {
  const quote = get("select * from quotes where id = ?", [id]);
  if (!quote) return null;
  const items = all(
    "select * from quote_items where quoteId = ? order by serialNumber",
    [id]
  ).map(mapItem);
  return {
    ...quote,
    subtotal: quote.subtotal ?? quote.subTotal ?? 0,
    tax: quote.tax ?? quote.totalTax ?? 0,
    customerName: customerName(quote.customerId),
    items,
  };
}

export function getInvoice(id) {
  const invoice = get("select * from invoices where id = ?", [id]);
  if (!invoice) return null;
  const items = all(
    "select * from invoice_items where invoiceId = ? order by serialNumber",
    [id]
  ).map(mapItem);
  return { ...invoice, customerName: customerName(invoice.customerId), items };
}

export function blankQuote() {
  const now = new Date().toISOString();
  return {
    id: "",
    number: nextNumber("quotes", "Quote"),
    date: now.slice(0, 10),
    customerId: "",
    notes: "",
    terms: "",
    items: [emptyLine()],
  };
}

export function blankInvoice() {
  const now = new Date().toISOString();
  return {
    id: "",
    number: nextNumber("invoices", "Invoice"),
    date: now.slice(0, 10),
    duration: now.slice(0, 7),
    customerId: "",
    quoteId: "",
    poNumbers: "",
    notes: "",
    terms: "",
    status: "draft",
    amountReceived: 0,
    items: [emptyLine()],
  };
}

function emptyLine() {
  return recomputeLine({
    id: randomUUID(),
    vehicleTypeId: "",
    vehicleTypeLabel: "",
    vehicleNumber: "",
    description: "",
    rentalBasis: "",
    quantity: 1,
    unitPrice: 0,
    taxPercent: 5,
  });
}

export function invoiceFromQuote(quoteId) {
  const quote = getQuote(quoteId);
  if (!quote) return blankInvoice();
  const draft = blankInvoice();
  return {
    ...draft,
    customerId: quote.customerId || "",
    quoteId: quote.id,
    notes: quote.notes || "",
    terms: quote.terms || "",
    items: quote.items.map((item) => recomputeLine({ ...item, id: randomUUID() })),
  };
}

export function invoiceFromInvoice(invoiceId) {
  const invoice = getInvoice(invoiceId);
  if (!invoice) return blankInvoice();
  const draft = blankInvoice();
  return {
    ...draft,
    customerId: invoice.customerId || "",
    quoteId: invoice.quoteId || "",
    duration: invoice.duration || draft.duration,
    poNumbers: invoice.poNumbers || "",
    notes: invoice.notes || "",
    terms: invoice.terms || "",
    items: invoice.items.map((item) => recomputeLine({ ...item, id: randomUUID() })),
  };
}

export function saveQuote(input) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const items = (input.items || []).map((item, index) =>
    recomputeLine({ ...item, id: item.id || randomUUID(), serialNumber: index + 1 })
  );
  const totals = summarize(items);
  const existing = get("select id from quotes where id = ?", [id]);
  if (existing) {
    run(
      `update quotes set number=?, date=?, customerId=?, subTotal=?, totalTax=?, total=?, notes=?, terms=?, updatedAt=? where id=?`,
      [input.number, input.date, input.customerId || null, totals.subtotal, totals.tax, totals.total, input.notes || "", input.terms || "", now, id]
    );
    run("delete from quote_items where quoteId = ?", [id]);
  } else {
    run(
      `insert into quotes (id, number, date, currency, customerId, subTotal, totalTax, total, notes, terms, createdAt, updatedAt) values (?, ?, ?, 'AED', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.number, input.date, input.customerId || null, totals.subtotal, totals.tax, totals.total, input.notes || "", input.terms || "", now, now]
    );
  }
  for (const item of items) insertQuoteItem(id, item);
  return id;
}

function insertQuoteItem(quoteId, item) {
  run(
    `insert into quote_items (id, quoteId, vehicleTypeId, vehicleTypeLabel, vehicleNumber, description, rentalBasis, serialNumber, quantity, unitPrice, taxPercent, grossAmount, lineTaxAmount, lineTotal)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      quoteId,
      item.vehicleTypeId || "",
      item.vehicleTypeLabel || "",
      item.vehicleNumber || null,
      item.description || null,
      item.rentalBasis || null,
      item.serialNumber || null,
      item.quantity || 0,
      item.unitPrice || 0,
      item.taxPercent || 0,
      item.grossAmount || 0,
      item.lineTaxAmount || 0,
      item.lineTotal || 0,
    ]
  );
}

export function saveInvoice(input) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const items = (input.items || []).map((item, index) =>
    recomputeLine({ ...item, id: item.id || randomUUID(), serialNumber: index + 1 })
  );
  const totals = summarize(items);
  const existing = get("select id from invoices where id = ?", [id]);
  if (existing) {
    run(
      `update invoices set number=?, date=?, duration=?, customerId=?, quoteId=?, poNumbers=?, subtotal=?, tax=?, total=?, amountReceived=?, status=?, notes=?, terms=?, updatedAt=? where id=?`,
      [
        input.number,
        input.date,
        input.duration || null,
        input.customerId || null,
        input.quoteId || null,
        input.poNumbers || null,
        totals.subtotal,
        totals.tax,
        totals.total,
        Number(input.amountReceived) || 0,
        input.status || "draft",
        input.notes || "",
        input.terms || "",
        now,
        id,
      ]
    );
    run("delete from invoice_items where invoiceId = ?", [id]);
  } else {
    run(
      `insert into invoices (id, number, date, duration, customerId, quoteId, poNumbers, subtotal, tax, total, amountReceived, status, notes, terms, createdAt, updatedAt)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.number,
        input.date,
        input.duration || null,
        input.customerId || null,
        input.quoteId || null,
        input.poNumbers || null,
        totals.subtotal,
        totals.tax,
        totals.total,
        Number(input.amountReceived) || 0,
        input.status || "draft",
        input.notes || "",
        input.terms || "",
        now,
        now,
      ]
    );
  }
  for (const item of items) insertInvoiceItem(id, item);
  return id;
}

function insertInvoiceItem(invoiceId, item) {
  run(
    `insert into invoice_items (
      id, invoiceId, serialNumber, vehicleTypeId, vehicleTypeLabel, vehicleNumber,
      description, rentalBasis, quantity, unitPrice, taxPercent, tax,
      grossAmount, lineTaxAmount, lineTotal, total, amountReceived
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      invoiceId,
      item.serialNumber || null,
      item.vehicleTypeId || null,
      item.vehicleTypeLabel || null,
      item.vehicleNumber || null,
      item.description || null,
      item.rentalBasis || null,
      item.quantity || 0,
      item.unitPrice || 0,
      item.taxPercent || 0,
      item.lineTaxAmount || 0,
      item.grossAmount || 0,
      item.lineTaxAmount || 0,
      item.lineTotal || 0,
      item.lineTotal || 0,
      0,
    ]
  );
}

const MASTERS = {
  customers: ["name", "company", "email", "phone", "address", "trn"],
  vendors: ["name", "contactPerson", "email", "phone", "address", "bankDetails", "paymentTerms"],
  employees: ["name", "employeeId", "role", "paymentType", "hourlyRate", "salary", "overtimeRate", "bankDetails"],
  vehicles: ["vehicleNumber", "vehicleType", "make", "model", "year", "color", "status", "description", "basePrice", "notes"],
};

export function saveMaster(kind, input) {
  const fields = MASTERS[kind];
  if (!fields) throw new Error("Unknown master");
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const values = fields.map((field) => input[field] ?? "");
  const existing = get(`select id from ${kind} where id = ?`, [id]);
  if (existing) {
    const assignments = fields.map((field) => `${field} = ?`).join(", ");
    const updated = kind === "customers" ? `, updatedAt = ?` : "";
    run(`update ${kind} set ${assignments}${updated} where id = ?`, kind === "customers" ? [...values, now, id] : [...values, id]);
  } else if (kind === "customers") {
    run(
      `insert into customers (id, ${fields.join(", ")}, createdAt, updatedAt) values (?, ${fields.map(() => "?").join(", ")}, ?, ?)`,
      [id, ...values, now, now]
    );
  } else if (kind === "vehicles") {
    run(
      `insert into vehicles (id, ${fields.join(", ")}, createdAt) values (?, ${fields.map(() => "?").join(", ")}, ?)`,
      [id, ...values, now]
    );
  } else {
    run(
      `insert into ${kind} (id, ${fields.join(", ")}, createdAt) values (?, ${fields.map(() => "?").join(", ")}, ?)`,
      [id, ...values, now]
    );
  }
  return id;
}

export function deleteMaster(kind, id) {
  if (!MASTERS[kind]) throw new Error("Unknown master");
  run(`delete from ${kind} where id = ?`, [id]);
}

export function listPayslips() {
  return all(`
    select p.*, e.name as employeeName
    from payslips p
    left join employees e on e.id = p.employeeId
    order by p.month desc, e.name
  `);
}

export function savePayslip(input) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const baseSalary = Number(input.baseSalary) || 0;
  const overtimeHours = Number(input.overtimeHours) || 0;
  const overtimeRate = Number(input.overtimeRate) || 0;
  const overtimePay = overtimeHours * overtimeRate;
  const deductions = Number(input.deductions) || 0;
  const netPay = baseSalary + overtimePay - deductions;
  const existing = get("select id from payslips where id = ?", [id]);
  const params = [
    input.month || now.slice(0, 7),
    Number(String(input.month || now).slice(0, 4)) || new Date().getFullYear(),
    input.employeeId || null,
    baseSalary,
    overtimeHours,
    overtimeRate,
    overtimePay,
    deductions,
    input.deductionRemarks || "",
    netPay,
    input.status || "draft",
    input.notes || "",
    now,
  ];
  if (existing) {
    run(
      `update payslips set month=?, year=?, employeeId=?, baseSalary=?, overtimeHours=?, overtimeRate=?, overtimePay=?, deductions=?, deductionRemarks=?, netPay=?, status=?, notes=?, updatedAt=? where id=?`,
      [...params, id]
    );
  } else {
    run(
      `insert into payslips (id, month, year, employeeId, baseSalary, overtimeHours, overtimeRate, overtimePay, deductions, deductionRemarks, netPay, status, notes, createdAt, updatedAt)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ...params, now]
    );
  }
  return id;
}

export function getSettings() {
  return get("select * from admin_settings limit 1") || {
    id: "company",
    companyName: "ALMSAR ALZAKI TRANSPORT AND GENERAL MAINTENANCE",
    address: "Al Sila, Hamdan Street, Abu Dhabi",
    vatNumber: "105061702400003",
    footerContactEnglish: "+971 54 311 4444",
    footerAddressEnglish: "info@almsaralzaki.com",
    currency: "AED",
    defaultTerms: "",
  };
}

export function saveSettings(input) {
  const now = new Date().toISOString();
  const current = get("select id from admin_settings limit 1");
  if (current) {
    run(
      `update admin_settings set companyName=?, address=?, vatNumber=?, footerContactEnglish=?, footerAddressEnglish=?, currency=?, defaultTerms=?, updatedAt=? where id=?`,
      [
        input.companyName || "",
        input.address || "",
        input.vatNumber || "",
        input.footerContactEnglish || "",
        input.footerAddressEnglish || "",
        input.currency || "AED",
        input.defaultTerms || "",
        now,
        current.id,
      ]
    );
    return current.id;
  }
  const id = randomUUID();
  run(
    `insert into admin_settings (id, companyName, address, vatNumber, footerContactEnglish, footerAddressEnglish, currency, defaultTerms, createdAt, updatedAt)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.companyName || "", input.address || "", input.vatNumber || "", input.footerContactEnglish || "", input.footerAddressEnglish || "", input.currency || "AED", input.defaultTerms || "", now, now]
  );
  return id;
}

export function blankPurchaseOrder() {
  const now = new Date().toISOString();
  return {
    id: "",
    number: nextNumber("purchase_orders", "PO"),
    date: now.slice(0, 10),
    vendorId: "",
    status: "draft",
    notes: "",
    terms: "",
    items: [emptyLine()],
  };
}

export function getPurchaseOrder(id) {
  const order = get("select * from purchase_orders where id = ?", [id]);
  if (!order) return null;
  const vendor = get("select * from vendors where id = ?", [order.vendorId]);
  const items = all("select * from po_items where purchaseOrderId = ? order by serialNumber", [id]).map(mapItem);
  return {
    ...order,
    subtotal: order.subtotal || 0,
    tax: order.tax || 0,
    total: order.amount || 0,
    vendorName: vendor?.name || "",
    customerName: vendor?.name || "",
    customer: vendor || null,
    items,
  };
}

export function purchaseOrdersForDesk() {
  return listPurchaseOrders().map((row) => getPurchaseOrder(row.id)).filter(Boolean);
}

export function savePurchaseOrder(input) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const items = (input.items || []).map((item, index) =>
    recomputeLine({ ...item, id: item.id || randomUUID(), serialNumber: index + 1 })
  );
  const totals = summarize(items);
  const existing = get("select id from purchase_orders where id = ?", [id]);
  if (!input.vendorId) throw new Error("Vendor is required");
  if (existing) {
    run(
      `update purchase_orders set number=?, date=?, vendorId=?, subtotal=?, tax=?, amount=?, currency='AED', status=?, terms=?, notes=? where id=?`,
      [input.number, input.date, input.vendorId, totals.subtotal, totals.tax, totals.total, input.status || "draft", input.terms || "", input.notes || "", id]
    );
    run("delete from po_items where purchaseOrderId = ?", [id]);
  } else {
    run(
      `insert into purchase_orders (id, number, date, vendorId, subtotal, tax, amount, currency, status, terms, notes, createdAt)
       values (?, ?, ?, ?, ?, ?, ?, 'AED', ?, ?, ?, ?)`,
      [id, input.number, input.date, input.vendorId, totals.subtotal, totals.tax, totals.total, input.status || "draft", input.terms || "", input.notes || "", now]
    );
  }
  for (const item of items) {
    run(
      `insert into po_items (id, purchaseOrderId, serialNumber, vehicleTypeId, vehicleTypeLabel, vehicleNumber, description, rentalBasis, quantity, unitPrice, taxPercent, grossAmount, lineTaxAmount, lineTotal, total)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, id, item.serialNumber, item.vehicleTypeId || "", item.vehicleTypeLabel || "", item.vehicleNumber || "", item.description || "", item.rentalBasis || "", item.quantity, item.unitPrice, item.taxPercent, item.grossAmount, item.lineTaxAmount, item.lineTotal, item.lineTotal]
    );
  }
  return id;
}

export function deletePurchaseOrder(id) {
  run("delete from po_items where purchaseOrderId = ?", [id]);
  run("delete from purchase_orders where id = ?", [id]);
}
