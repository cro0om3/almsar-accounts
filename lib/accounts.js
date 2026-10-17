import { randomUUID } from "crypto";
import { all, get, nextNumber, run } from "./local-db";
import { recomputeLine, summarize } from "./money";
import { isFleetVehicle } from "./vehicle-kind";

async function  customerName(id) {
  if (!id) return "";
  const row = await get("select name from customers where id = ?", [id]);
  return row?.name || "";
}

export async function dashboard() {
  const month = new Date().toISOString().slice(0, 7);
  const [invoices, quotes, customers] = await Promise.all([
    all("select id, number, date, total, amountReceived, status, customerId, createdAt from invoices"),
    all("select id, number, date, total, customerId, createdAt from quotes"),
    all("select id, name, createdAt from customers"),
  ]);
  const billed = invoices.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const received = invoices.reduce((sum, row) => sum + (Number(row.amountReceived) || 0), 0);
  const quoteValue = quotes.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
  const inMonth = (row) => String(row.date || row.createdAt || "").startsWith(month);
  let revenue = 0;
  let expenses = 0;
  let expenseLines = [];
  try {
    await ensureExpenseTables();
    const [tx, general] = await Promise.all([
      all("select transactionType, amount, date, month from vehicle_transactions"),
      all("select amount, date from general_expenses"),
    ]);
    for (const row of tx) {
      if (row.transactionType === "expense") {
        expenses += Number(row.amount) || 0;
        expenseLines.push({ amount: row.amount, date: row.date || row.month || "" });
      } else revenue += Number(row.amount) || 0;
    }
    for (const row of general) {
      expenses += Number(row.amount) || 0;
      expenseLines.push(row);
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
  let payroll = 0;
  let vehicleCount = 0;
  let employees = 0;
  let alerts = [];
  try {
    const [salaries, vehicles, notice] = await Promise.all([
      all("select salary from employees"),
      get("select count(*) as c from vehicles"),
      vehicleAlerts(),
    ]);
    payroll = salaries.reduce((sum, row) => sum + (Number(row.salary) || 0), 0);
    vehicleCount = Number(vehicles?.c) || 0;
    alerts = notice;
    employees = salaries.length;
  } catch {
    payroll = 0;
  }
  const monthKeys = [];
  const nowDate = new Date();
  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(nowDate.getFullYear(), nowDate.getMonth() - index, 1);
    monthKeys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  const months = monthKeys.map((key) => ({
    key,
    revenue: invoices
      .filter((row) => String(row.date || "").startsWith(key))
      .reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    expenses: expenseLines
      .filter((row) => String(row.date || "").startsWith(key))
      .reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
  }));
  return {
    customers: customers.length,
    vehicles: vehicleCount,
    employees,
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
    payroll,
    months,
    topCustomers,
    activity,
    alerts,
    recent: invoices
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8)
      .map((row) => ({ ...row, customerName: names[row.customerId] || "" })),
  };
}

export async function listCustomers() {
  return await all("select * from customers order by name");
}

export async function saveCustomer(input) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const existing = await get("select id from customers where id = ?", [id]);
  if (existing) {
    await run(
      `update customers set name=?, company=?, email=?, phone=?, address=?, trn=?, updatedAt=? where id=?`,
      [input.name, input.company || "", input.email || "", input.phone || "", input.address || "", input.trn || "", now, id]
    );
  } else {
    await run(
      `insert into customers (id, name, company, email, phone, address, trn, createdAt, updatedAt) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.name, input.company || "", input.email || "", input.phone || "", input.address || "", input.trn || "", now, now]
    );
  }
  return id;
}

export async function  listVehicles() {
  return await all("select * from vehicles order by vehicleNumber");
}

export async function listVendors() {
  return await all("select * from vendors order by name");
}

export async function listEmployees() {
  return await all("select * from employees order by name");
}

export async function  listQuotes() {
  return await all(`
    select q.*, c.name as customerName, c.company as customerCompany, c.email as customerEmail, c.phone as customerPhone, c.address as customerAddress, c.trn as customerTrn
    from quotes q
    left join customers c on c.id = q.customerId
    order by q.createdAt desc
  `);
}

export async function  listInvoices() {
  return await all(`
    select i.*, c.name as customerName, c.company as customerCompany, c.email as customerEmail, c.phone as customerPhone, c.address as customerAddress, c.trn as customerTrn
    from invoices i
    left join customers c on c.id = i.customerId
    order by i.createdAt desc
  `);
}

function customerFromRow(row) {
  if (!row?.customerId && !row?.customerName) return null;
  return {
    id: row.customerId || "",
    name: row.customerName || "",
    company: row.customerCompany || "",
    email: row.customerEmail || "",
    phone: row.customerPhone || "",
    address: row.customerAddress || "",
    trn: row.customerTrn || "",
  };
}

function itemsBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row[key]) || [];
    list.push(mapItem(row));
    grouped.set(row[key], list);
  }
  return grouped;
}

async function  customerRecord(id) {
  if (!id) return null;
  return await get("select id, name, company, email, phone, address, trn from customers where id = ?", [id]);
}

export async function quotesForDesk() {
  const [rows, items] = await Promise.all([
    listQuotes(),
    all("select * from quote_items order by serialNumber"),
  ]);
  const grouped = itemsBy(items, "quoteId");
  return rows.map((row) => ({
    ...row,
    subtotal: row.subtotal ?? row.subTotal ?? 0,
    tax: row.tax ?? row.totalTax ?? 0,
    items: grouped.get(row.id) || [],
    customer: customerFromRow(row),
  }));
}

export async function invoicesForDesk() {
  const [rows, items] = await Promise.all([
    listInvoices(),
    all("select * from invoice_items order by serialNumber"),
  ]);
  const grouped = itemsBy(items, "invoiceId");
  return rows.map((row) => ({
    ...row,
    items: grouped.get(row.id) || [],
    customer: customerFromRow(row),
  }));
}

export async function financesForDesk() {
  let transactions = [];
  try {
    transactions = await all("select * from vehicle_transactions");
  } catch {
    transactions = [];
  }
  const vehicles = await listVehicles();
  return vehicles.map((vehicle) => {
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

export async function deleteQuote(id) {
  await run("delete from quote_items where quoteId = ?", [id]);
  await run("delete from quotes where id = ?", [id]);
}

export async function deleteInvoice(id) {
  await run("delete from invoice_items where invoiceId = ?", [id]);
  await run("delete from invoices where id = ?", [id]);
}

export async function recordPayment(id, amount) {
  const invoice = await get("select total from invoices where id = ?", [id]);
  if (!invoice) return;
  const received = Number(amount) || 0;
  const status = received >= Number(invoice.total || 0) ? "payment_received" : "invoice_sent";
  await run("update invoices set amountReceived = ?, status = ?, updatedAt = ? where id = ?", [
    received,
    status,
    new Date().toISOString(),
    id,
  ]);
}

export async function  listPurchaseOrders() {
  return await all(`
    select p.*, v.name as vendorName, v.email as vendorEmail, v.phone as vendorPhone, v.address as vendorAddress
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

export async function  getQuote(id) {
  const [quote, items] = await Promise.all([
    get("select q.*, c.name as customerName from quotes q left join customers c on c.id = q.customerId where q.id = ?", [id]),
    all("select * from quote_items where quoteId = ? order by serialNumber", [id]),
  ]);
  if (!quote) return null;
  return {
    ...quote,
    subtotal: quote.subtotal ?? quote.subTotal ?? 0,
    tax: quote.tax ?? quote.totalTax ?? 0,
    items: items.map(mapItem),
  };
}

export async function  getInvoice(id) {
  const [invoice, items] = await Promise.all([
    get("select i.*, c.name as customerName from invoices i left join customers c on c.id = i.customerId where i.id = ?", [id]),
    all("select * from invoice_items where invoiceId = ? order by serialNumber", [id]),
  ]);
  if (!invoice) return null;
  return { ...invoice, items: items.map(mapItem) };
}

export async function  blankQuote() {
  const now = new Date().toISOString();
  return {
    id: "",
    number: await nextNumber("quotes", "Quote"),
    date: now.slice(0, 10),
    customerId: "",
    notes: "",
    terms: "",
    status: "draft",
    items: [emptyLine()],
  };
}

export async function  blankInvoice() {
  const now = new Date().toISOString();
  return {
    id: "",
    number: await nextNumber("invoices", "Invoice"),
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

export async function invoiceFromQuote(quoteId) {
  const quote = await getQuote(quoteId);
  if (!quote) return await blankInvoice();
  const draft = await blankInvoice();
  return {
    ...draft,
    customerId: quote.customerId || "",
    quoteId: quote.id,
    notes: quote.notes || "",
    terms: quote.terms || "",
    items: quote.items.map((item) => recomputeLine({ ...item, id: randomUUID() })),
  };
}

export async function quoteFromQuote(quoteId) {
  const quote = await getQuote(quoteId);
  if (!quote) return await blankQuote();
  const draft = await blankQuote();
  return {
    ...draft,
    customerId: quote.customerId || "",
    notes: quote.notes || "",
    terms: quote.terms || "",
    status: "draft",
    items: quote.items.map((item) => recomputeLine({ ...item, id: randomUUID() })),
  };
}

export async function quoteFromInvoice(invoiceId) {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return await blankQuote();
  const draft = await blankQuote();
  return {
    ...draft,
    customerId: invoice.customerId || "",
    notes: invoice.notes || "",
    terms: invoice.terms || "",
    status: "draft",
    items: invoice.items.map((item) => recomputeLine({ ...item, id: randomUUID() })),
  };
}

export async function invoiceFromInvoice(invoiceId) {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return await blankInvoice();
  const draft = await blankInvoice();
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

async function ensureQuoteStatus() {
  try {
    await run("alter table quotes add column status text default 'draft'");
  } catch {
    /* column already exists */
  }
}

export async function saveQuote(input) {
  await ensureQuoteStatus();
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const items = (input.items || []).map((item, index) =>
    recomputeLine({ ...item, id: item.id || randomUUID(), serialNumber: index + 1 })
  );
  const totals = summarize(items);
  const existing = await get("select id from quotes where id = ?", [id]);
  if (existing) {
    await run(
      `update quotes set number=?, date=?, customerId=?, subTotal=?, totalTax=?, total=?, notes=?, terms=?, status=?, updatedAt=? where id=?`,
      [input.number, input.date, input.customerId || null, totals.subtotal, totals.tax, totals.total, input.notes || "", input.terms || "", input.status || "draft", now, id]
    );
    await run("delete from quote_items where quoteId = ?", [id]);
  } else {
    await run(
      `insert into quotes (id, number, date, currency, customerId, subTotal, totalTax, total, notes, terms, status, createdAt, updatedAt) values (?, ?, ?, 'AED', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.number, input.date, input.customerId || null, totals.subtotal, totals.tax, totals.total, input.notes || "", input.terms || "", input.status || "draft", now, now]
    );
  }
  for (const item of items) await insertQuoteItem(id, item);
  return id;
}

async function  insertQuoteItem(quoteId, item) {
  await run(
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

export async function saveInvoice(input) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const items = (input.items || []).map((item, index) =>
    recomputeLine({ ...item, id: item.id || randomUUID(), serialNumber: index + 1 })
  );
  const totals = summarize(items);
  const existing = await get("select id from invoices where id = ?", [id]);
  if (existing) {
    await run(
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
    await run("delete from invoice_items where invoiceId = ?", [id]);
  } else {
    await run(
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
  for (const item of items) await insertInvoiceItem(id, item);
  return id;
}

async function  insertInvoiceItem(invoiceId, item) {
  await run(
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
};

const ALERT_DAYS = 30;
let vehicleColumnsReady = false;

async function ensureVehicleColumns() {
  if (vehicleColumnsReady) return;
  for (const statement of [
    "alter table vehicles add column category text",
    "alter table vehicles add column ownershipExpiry text",
    "alter table vehicles add column ownershipPath text",
  ]) {
    try {
      await run(statement);
    } catch {
      /* The column is already there, or this login cannot change the table. */
    }
  }
  vehicleColumnsReady = true;
}

function alertDate(value, today) {
  const text = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00`);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + ALERT_DAYS);
  if (date > limit) return null;
  return { date: text, expired: date < today };
}

export async function vehicleAlerts() {
  try {
    await ensureVehicleColumns();
    const rows = await all("select id, vehicleNumber, vehicleType, category, registrationExpiry, ownershipExpiry from vehicles");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alerts = [];
    for (const row of rows) {
      if (!isFleetVehicle(row)) continue;
      for (const kind of ["vehicle", "ownership"]) {
        const source = kind === "vehicle" ? row.registrationExpiry : row.ownershipExpiry;
        const hit = alertDate(source, today);
        if (!hit) continue;
        alerts.push({ id: row.id, vehicleNumber: row.vehicleNumber || "", kind, ...hit });
      }
    }
    return alerts.sort((a, b) => a.date.localeCompare(b.date) || a.vehicleNumber.localeCompare(b.vehicleNumber));
  } catch {
    return [];
  }
}

async function saveVehicle(input) {
  await ensureVehicleColumns();
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const yearText = String(input.year || "").trim();
  const values = [
    String(input.vehicleNumber || "").trim(),
    input.vehicleType || "",
    input.category || "",
    yearText ? Number(yearText) : null,
    input.notes || "",
    String(input.registrationExpiry || "").slice(0, 10),
    String(input.ownershipExpiry || "").slice(0, 10),
    input.ownershipPath || "",
  ];
  const existing = await get("select id from vehicles where id = ?", [id]);
  if (existing) {
    await run(
      `update vehicles set vehicleNumber=?, vehicleType=?, category=?, year=?, notes=?, registrationExpiry=?, ownershipExpiry=?, ownershipPath=? where id=?`,
      [...values, id]
    );
  } else {
    await run(
      `insert into vehicles (id, vehicleNumber, vehicleType, category, year, notes, registrationExpiry, ownershipExpiry, ownershipPath, status, createdAt) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [id, ...values, now]
    );
  }
  return id;
}

export async function saveMaster(kind, input) {
  if (kind === "vehicles") return saveVehicle(input);
  const fields = MASTERS[kind];
  if (!fields) throw new Error("Unknown master");
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const values = fields.map((field) => input[field] ?? "");
  const existing = await get(`select id from ${kind} where id = ?`, [id]);
  if (existing) {
    const assignments = fields.map((field) => `${field} = ?`).join(", ");
    const updated = kind === "customers" ? `, updatedAt = ?` : "";
    await run(`update ${kind} set ${assignments}${updated} where id = ?`, kind === "customers" ? [...values, now, id] : [...values, id]);
  } else if (kind === "customers") {
    await run(
      `insert into customers (id, ${fields.join(", ")}, createdAt, updatedAt) values (?, ${fields.map(() => "?").join(", ")}, ?, ?)`,
      [id, ...values, now, now]
    );
  } else if (kind === "vehicles") {
    await run(
      `insert into vehicles (id, ${fields.join(", ")}, createdAt) values (?, ${fields.map(() => "?").join(", ")}, ?)`,
      [id, ...values, now]
    );
  } else {
    await run(
      `insert into ${kind} (id, ${fields.join(", ")}, createdAt) values (?, ${fields.map(() => "?").join(", ")}, ?)`,
      [id, ...values, now]
    );
  }
  return id;
}

async function countOf(sql, params) {
  try {
    const row = await get(sql, params);
    return Number(row?.n) || 0;
  } catch {
    return 0;
  }
}

async function masterInUse(kind, id) {
  if (kind === "customers") {
    const quotes = await countOf("select count(*) as n from quotes where customerId = ?", [id]);
    const invoices = await countOf("select count(*) as n from invoices where customerId = ?", [id]);
    return quotes + invoices > 0;
  }
  if (kind === "vendors") {
    return (await countOf("select count(*) as n from purchase_orders where vendorId = ?", [id])) > 0;
  }
  if (kind === "employees") {
    const slips = await countOf("select count(*) as n from payslips where employeeId = ?", [id]);
    const trips = await countOf("select count(*) as n from vehicle_transactions where employeeId = ?", [id]);
    return slips + trips > 0;
  }
  if (kind === "vehicles") {
    const vehicle = await get("select vehicleNumber from vehicles where id = ?", [id]);
    const number = vehicle?.vehicleNumber || "";
    const moves = await countOf("select count(*) as n from vehicle_transactions where vehicleId = ?", [id]);
    const quotes = number ? await countOf("select count(*) as n from quote_items where vehicleNumber = ?", [number]) : 0;
    const invoices = number ? await countOf("select count(*) as n from invoice_items where vehicleNumber = ?", [number]) : 0;
    return moves + quotes + invoices > 0;
  }
  return false;
}

export async function deleteMaster(kind, id) {
  if (!MASTERS[kind] && kind !== "vehicles") throw new Error("Unknown master");
  if (await masterInUse(kind, id)) return { error: "inUse" };
  await run(`delete from ${kind} where id = ?`, [id]);
  return { ok: true };
}

export async function listPayslips() {
  return await all(`
    select p.*, e.name as employeeName
    from payslips p
    left join employees e on e.id = p.employeeId
    order by p.month desc, e.name
  `);
}

export async function savePayslip(input) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const baseSalary = Number(input.baseSalary) || 0;
  const overtimeHours = Number(input.overtimeHours) || 0;
  const overtimeRate = Number(input.overtimeRate) || 0;
  const overtimePay = overtimeHours * overtimeRate;
  const deductions = Number(input.deductions) || 0;
  const netPay = baseSalary + overtimePay - deductions;
  const existing = await get("select id from payslips where id = ?", [id]);
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
    await run(
      `update payslips set month=?, year=?, employeeId=?, baseSalary=?, overtimeHours=?, overtimeRate=?, overtimePay=?, deductions=?, deductionRemarks=?, netPay=?, status=?, notes=?, updatedAt=? where id=?`,
      [...params, id]
    );
  } else {
    await run(
      `insert into payslips (id, month, year, employeeId, baseSalary, overtimeHours, overtimeRate, overtimePay, deductions, deductionRemarks, netPay, status, notes, createdAt, updatedAt)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ...params, now]
    );
  }
  return id;
}

export async function getSettings() {
  return await get("select * from admin_settings limit 1") || {
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

export async function saveSettings(input) {
  const now = new Date().toISOString();
  const current = await get("select id from admin_settings limit 1");
  if (current) {
    await run(
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
  await run(
    `insert into admin_settings (id, companyName, address, vatNumber, footerContactEnglish, footerAddressEnglish, currency, defaultTerms, createdAt, updatedAt)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.companyName || "", input.address || "", input.vatNumber || "", input.footerContactEnglish || "", input.footerAddressEnglish || "", input.currency || "AED", input.defaultTerms || "", now, now]
  );
  return id;
}

export async function blankPurchaseOrder() {
  const now = new Date().toISOString();
  return {
    id: "",
    number: await nextNumber("purchase_orders", "PO"),
    date: now.slice(0, 10),
    vendorId: "",
    status: "draft",
    notes: "",
    terms: "",
    items: [emptyLine()],
  };
}

export async function  getPurchaseOrder(id) {
  const order = await get("select * from purchase_orders where id = ?", [id]);
  if (!order) return null;
  const vendor = await get("select * from vendors where id = ?", [order.vendorId]);
  const items = (await all("select * from po_items where purchaseOrderId = ? order by serialNumber", [id])).map(mapItem);
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

export async function purchaseOrdersForDesk() {
  const [rows, items] = await Promise.all([
    listPurchaseOrders(),
    all("select * from po_items order by serialNumber"),
  ]);
  const grouped = itemsBy(items, "purchaseOrderId");
  return rows.map((row) => ({
    ...row,
    subtotal: row.subtotal || 0,
    tax: row.tax || 0,
    total: row.amount || 0,
    customerName: row.vendorName || "",
    customer: row.vendorId ? { id: row.vendorId, name: row.vendorName || "", email: row.vendorEmail || "", phone: row.vendorPhone || "", address: row.vendorAddress || "" } : null,
    items: grouped.get(row.id) || [],
  }));
}

export async function savePurchaseOrder(input) {
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const items = (input.items || []).map((item, index) =>
    recomputeLine({ ...item, id: item.id || randomUUID(), serialNumber: index + 1 })
  );
  const totals = summarize(items);
  const existing = await get("select id from purchase_orders where id = ?", [id]);
  if (!input.vendorId) throw new Error("Vendor is required");
  if (existing) {
    await run(
      `update purchase_orders set number=?, date=?, vendorId=?, subtotal=?, tax=?, amount=?, currency='AED', status=?, terms=?, notes=? where id=?`,
      [input.number, input.date, input.vendorId, totals.subtotal, totals.tax, totals.total, input.status || "draft", input.terms || "", input.notes || "", id]
    );
    await run("delete from po_items where purchaseOrderId = ?", [id]);
  } else {
    await run(
      `insert into purchase_orders (id, number, date, vendorId, subtotal, tax, amount, currency, status, terms, notes, createdAt)
       values (?, ?, ?, ?, ?, ?, ?, 'AED', ?, ?, ?, ?)`,
      [id, input.number, input.date, input.vendorId, totals.subtotal, totals.tax, totals.total, input.status || "draft", input.terms || "", input.notes || "", now]
    );
  }
  for (const item of items) {
    await run(
      `insert into po_items (id, purchaseOrderId, serialNumber, vehicleTypeId, vehicleTypeLabel, vehicleNumber, description, rentalBasis, quantity, unitPrice, taxPercent, grossAmount, lineTaxAmount, lineTotal, total)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, id, item.serialNumber, item.vehicleTypeId || "", item.vehicleTypeLabel || "", item.vehicleNumber || "", item.description || "", item.rentalBasis || "", item.quantity, item.unitPrice, item.taxPercent, item.grossAmount, item.lineTaxAmount, item.lineTotal, item.lineTotal]
    );
  }
  return id;
}

export async function deletePurchaseOrder(id) {
  await run("delete from po_items where purchaseOrderId = ?", [id]);
  await run("delete from purchase_orders where id = ?", [id]);
}

let expenseTablesReady = false;

async function ensureExpenseTables() {
  if (expenseTablesReady) return;
  await run(`create table if not exists general_expenses (
    id text primary key,
    description text,
    category text,
    amount double precision,
    date text,
    notes text,
    receiptPath text,
    createdAt text,
    updatedAt text
  )`);
  for (const statement of [
    "alter table vehicle_transactions add column receiptPath text",
    "alter table vehicle_transactions add column notes text",
  ]) {
    try {
      await run(statement);
    } catch {
      // The column is already there.
    }
  }
  expenseTablesReady = true;
}

function expenseView(row) {
  return {
    id: row.id,
    description: row.description || "",
    category: row.category || "other",
    amount: Number(row.amount) || 0,
    date: String(row.date || "").slice(0, 10),
    notes: row.notes || "",
    receiptPath: row.receiptPath || "",
    vehicleId: row.vehicleId || "",
  };
}

export async function expensesForDesk() {
  await ensureExpenseTables();
  const [vehicles, rows, general] = await Promise.all([
    all("select id, vehicleNumber, vehicleType, category from vehicles order by vehicleNumber"),
    all("select * from vehicle_transactions where transactionType = 'expense' order by date desc"),
    all("select * from general_expenses order by date desc"),
  ]);
  return {
    vehicles: vehicles.filter(isFleetVehicle).map((vehicle) => ({
      id: vehicle.id,
      vehicleNumber: vehicle.vehicleNumber || "",
      vehicleType: vehicle.vehicleType || "",
      expenses: rows.filter((row) => row.vehicleId === vehicle.id).map(expenseView),
    })),
    general: general.map(expenseView),
  };
}

export async function saveVehicleExpense(input) {
  await ensureExpenseTables();
  const now = new Date().toISOString();
  const id = randomUUID();
  const date = String(input.date || now).slice(0, 10);
  await run(
    `insert into vehicle_transactions (id, vehicleId, transactionType, category, amount, date, month, description, notes, receiptPath, createdAt, updatedAt)
     values (?, ?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.vehicleId,
      input.category || "other",
      Number(input.amount) || 0,
      date,
      date.slice(0, 7),
      input.description || "",
      input.notes || "",
      input.receiptPath || "",
      now,
      now,
    ]
  );
  return id;
}

export async function saveGeneralExpense(input) {
  await ensureExpenseTables();
  const now = new Date().toISOString();
  const id = randomUUID();
  const date = String(input.date || now).slice(0, 10);
  await run(
    `insert into general_expenses (id, description, category, amount, date, notes, receiptPath, createdAt, updatedAt)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.description || "", input.category || "petty", Number(input.amount) || 0, date, input.notes || "", input.receiptPath || "", now, now]
  );
  return id;
}

export async function deleteExpense(kind, id) {
  await ensureExpenseTables();
  const table = kind === "general" ? "general_expenses" : "vehicle_transactions";
  const row = await get(`select receiptPath from ${table} where id = ?`, [id]);
  if (kind === "general") await run("delete from general_expenses where id = ?", [id]);
  else await run("delete from vehicle_transactions where id = ? and transactionType = 'expense'", [id]);
  return row?.receiptPath || "";
}
