import { customerTitle } from "./party";

export const REPORT_GROUPS = [
  {
    label: "salesGroup",
    reports: ["sales-by-customer", "invoice-details", "customer-balance", "payments-received"],
  },
  {
    label: "purchasesGroup",
    reports: ["expense-details", "vendor-balance"],
  },
  {
    label: "vatGroup",
    reports: ["vat-audit"],
  },
  {
    label: "payrollGroup",
    reports: ["payroll"],
  },
];

export const REPORTS = {
  "sales-by-customer": {
    title: "salesByCustomer",
    desc: "salesByCustomerDesc",
    sub: "salesByCustomerSub",
    customer: true,
    status: "invoice",
  },
  "invoice-details": {
    title: "invoiceDetails",
    desc: "invoiceDetailsDesc",
    sub: "invoiceDetailsSub",
    customer: true,
    status: "invoice",
  },
  "customer-balance": {
    title: "customerBalance",
    desc: "customerBalanceDesc",
    sub: "customerBalanceSub",
    customer: true,
  },
  "payments-received": {
    title: "paymentsReceived",
    desc: "paymentsReceivedDesc",
    sub: "paymentsReceivedSub",
    customer: true,
  },
  "expense-details": {
    title: "expenseDetailsReport",
    desc: "expenseDetailsDesc",
    sub: "expenseDetailsSub",
    vendor: true,
    status: "po",
  },
  "vendor-balance": {
    title: "vendorBalance",
    desc: "vendorBalanceDesc",
    sub: "vendorBalanceSub",
    vendor: true,
  },
  "vat-audit": {
    title: "vatAudit",
    desc: "vatAuditDesc",
    sub: "vatAuditSub",
  },
  payroll: {
    title: "payrollSummary",
    desc: "payrollSummaryDesc",
    sub: "payrollSummarySub",
  },
};

export const LATER_REPORTS = [
  ["profitAndLoss", "profitAndLossDesc"],
  ["balanceSheet", "balanceSheetDesc"],
  ["cashFlow", "cashFlowDesc"],
  ["generalLedger", "generalLedgerDesc"],
  ["trialBalance", "trialBalanceDesc"],
  ["projectCost", "projectCostDesc"],
];

export const EMPTY_FILTERS = { from: "", to: "", customerId: "", vendorId: "", status: "" };

function n(value) {
  return Number(value) || 0;
}

function ymd(value) {
  return String(value || "").slice(0, 10);
}

function inRange(date, filters) {
  const day = ymd(date);
  if (filters.from && day < filters.from) return false;
  if (filters.to && day > filters.to) return false;
  return true;
}

function cancelled(status) {
  const value = String(status || "").toLowerCase();
  return value === "cancelled" || value === "canceled" || value === "void";
}

function balanceOf(row) {
  return Math.max(0, n(row.total) - n(row.amountReceived));
}

function daysOverdue(row) {
  const due = ymd(row.dueDate || row.date);
  if (!due || balanceOf(row) <= 0.009) return 0;
  const days = Math.floor((Date.now() - new Date(`${due}T00:00:00`).getTime()) / 86400000);
  return days > 0 ? days : 0;
}

function agingBucket(row) {
  const days = daysOverdue(row);
  if (days <= 0) return "current";
  if (days <= 30) return "d1";
  if (days <= 60) return "d2";
  if (days <= 90) return "d3";
  return "d4";
}

function partyName(row, list, idKey, unknown) {
  const title = customerTitle(row);
  if (title) return title;
  const found = (list || []).find((item) => item.id === row[idKey]);
  return customerTitle(found) || found?.name || unknown;
}

function statusMatches(row, filter) {
  if (!filter) return true;
  if (filter === "partial") return n(row.amountReceived) > 0.009 && balanceOf(row) > 0.009;
  const status = String(row.status || "").toLowerCase();
  if (filter === "invoice_sent") return status === "invoice_sent" || status === "sent";
  if (filter === "payment_received") return status === "payment_received" || status === "paid";
  return status === filter;
}

function statusLabel(status, t) {
  const value = String(status || "").toLowerCase();
  if (!value || value === "draft") return t.draft;
  if (value === "invoice_sent" || value === "sent" || value === "processed") return t.sent;
  if (value === "payment_received" || value === "paid") return t.paid;
  if (value === "accepted") return t.accepted;
  if (value === "declined") return t.declined;
  if (cancelled(value)) return t.cancelled;
  return status || "";
}

function filteredInvoices(data, filters) {
  return (data.invoices || []).filter((row) => {
    if (!inRange(row.date, filters)) return false;
    if (filters.customerId && row.customerId !== filters.customerId) return false;
    if (!statusMatches(row, filters.status)) return false;
    return !cancelled(row.status);
  });
}

function filteredOrders(data, filters) {
  return (data.purchaseOrders || []).filter((row) => {
    if (!inRange(row.date, filters)) return false;
    if (filters.vendorId && row.vendorId !== filters.vendorId) return false;
    if (filters.status && String(row.status || "").toLowerCase() !== filters.status) return false;
    return !cancelled(row.status);
  });
}

function payslipDay(row) {
  const month = String(row.month || "");
  if (/^\d{4}-\d{2}/.test(month)) return `${month.slice(0, 7)}-01`;
  const year = String(row.year || "");
  const part = month.padStart(2, "0");
  return year && month ? `${year}-${part}-01` : "";
}

function payslipMonth(row) {
  const month = String(row.month || "");
  if (/^\d{4}-\d{2}/.test(month)) return month.slice(0, 7);
  return month;
}

function payslipYear(row) {
  const month = String(row.month || "");
  if (/^\d{4}/.test(month)) return month.slice(0, 4);
  return String(row.year || "");
}

function sum(rows, pick) {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function col(label, kind = "text") {
  return { label, kind };
}

function salesByCustomer(rows, data, t) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.customerId || "unknown";
    const current = map.get(key) || { name: partyName(row, data.customers, "customerId", t.unknownParty), count: 0, subtotal: 0, tax: 0, total: 0, received: 0 };
    current.count += 1;
    current.subtotal += n(row.subtotal);
    current.tax += n(row.tax);
    current.total += n(row.total);
    current.received += n(row.amountReceived);
    map.set(key, current);
  });
  const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    columns: [col(t.customer), col(t.invoices, "number"), col(t.subtotal, "money"), col(t.vat, "money"), col(t.total, "money"), col(t.received, "money"), col(t.balance, "money")],
    rows: list.map((row) => [row.name, row.count, row.subtotal, row.tax, row.total, row.received, row.total - row.received]),
    kpis: [
      { label: t.invoices, value: sum(list, (row) => row.count) },
      { label: t.salesTotal, value: sum(list, (row) => row.total), money: true },
      { label: t.vat, value: sum(list, (row) => row.tax), money: true },
      { label: t.outstanding, value: sum(list, (row) => row.total - row.received), money: true },
    ],
  };
}

function invoiceDetails(rows, data, t) {
  const list = [...rows].sort((a, b) => ymd(b.date).localeCompare(ymd(a.date)));
  return {
    columns: [col(t.invoices), col(t.date), col(t.customer), col(t.status), col(t.subtotal, "money"), col(t.vat, "money"), col(t.total, "money"), col(t.received, "money"), col(t.balance, "money")],
    rows: list.map((row) => [
      row.number || row.id,
      ymd(row.date),
      partyName(row, data.customers, "customerId", t.unknownParty),
      statusLabel(row.status, t),
      n(row.subtotal),
      n(row.tax),
      n(row.total),
      n(row.amountReceived),
      balanceOf(row),
    ]),
    kpis: [
      { label: t.invoices, value: list.length },
      { label: t.total, value: sum(list, (row) => n(row.total)), money: true },
      { label: t.vat, value: sum(list, (row) => n(row.tax)), money: true },
      { label: t.outstanding, value: sum(list, (row) => balanceOf(row)), money: true },
    ],
  };
}

function customerBalance(rows, data, t) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.customerId || "unknown";
    const current = map.get(key) || {
      name: partyName(row, data.customers, "customerId", t.unknownParty),
      count: 0, total: 0, received: 0, current: 0, d1: 0, d2: 0, d3: 0, d4: 0,
    };
    current.count += 1;
    current.total += n(row.total);
    current.received += n(row.amountReceived);
    current[agingBucket(row)] += balanceOf(row);
    map.set(key, current);
  });
  const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    columns: [col(t.customer), col(t.invoices, "number"), col(t.billed, "money"), col(t.received, "money"), col(t.agingCurrent, "money"), col(t.aging30, "money"), col(t.aging60, "money"), col(t.aging90, "money"), col(t.aging90p, "money"), col(t.balance, "money")],
    rows: list.map((row) => [row.name, row.count, row.total, row.received, row.current, row.d1, row.d2, row.d3, row.d4, row.total - row.received]),
    kpis: [
      { label: t.customers, value: list.length },
      { label: t.outstanding, value: sum(list, (row) => row.total - row.received), money: true },
    ],
  };
}

function paymentsReceived(rows, data, t) {
  const list = rows.filter((row) => n(row.amountReceived) > 0).sort((a, b) => ymd(b.date).localeCompare(ymd(a.date)));
  return {
    columns: [col(t.date), col(t.invoices), col(t.customer), col(t.invoiceTotal, "money"), col(t.received, "money"), col(t.balance, "money"), col(t.status)],
    rows: list.map((row) => [
      ymd(row.date),
      row.number || row.id,
      partyName(row, data.customers, "customerId", t.unknownParty),
      n(row.total),
      n(row.amountReceived),
      balanceOf(row),
      statusLabel(row.status, t),
    ]),
    kpis: [
      { label: t.paymentsReceived, value: list.length },
      { label: t.received, value: sum(list, (row) => n(row.amountReceived)), money: true },
    ],
  };
}

function expenseDetails(rows, data, t) {
  const list = [...rows].sort((a, b) => ymd(b.date).localeCompare(ymd(a.date)));
  return {
    columns: [col(t.purchaseOrders), col(t.date), col(t.vendor), col(t.status), col(t.subtotal, "money"), col(t.vat, "money"), col(t.amount, "money")],
    rows: list.map((row) => [
      row.number || row.id,
      ymd(row.date),
      row.vendorName || partyName(row, data.vendors, "vendorId", t.unknownParty),
      statusLabel(row.status, t),
      n(row.subtotal),
      n(row.tax),
      n(row.amount),
    ]),
    kpis: [
      { label: t.posCount, value: list.length },
      { label: t.amount, value: sum(list, (row) => n(row.amount)), money: true },
      { label: t.inputVat, value: sum(list, (row) => n(row.tax)), money: true },
    ],
  };
}

function vendorBalance(rows, data, t) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.vendorId || "unknown";
    const current = map.get(key) || { name: row.vendorName || partyName(row, data.vendors, "vendorId", t.unknownParty), count: 0, amount: 0 };
    current.count += 1;
    current.amount += n(row.amount);
    map.set(key, current);
  });
  const list = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    columns: [col(t.vendor), col(t.posCount, "number"), col(t.amount, "money")],
    rows: list.map((row) => [row.name, row.count, row.amount]),
    kpis: [
      { label: t.vendors, value: list.length },
      { label: t.amount, value: sum(list, (row) => row.amount), money: true },
    ],
  };
}

function vatAudit(invoices, orders, t) {
  const output = sum(invoices, (row) => n(row.tax));
  const input = sum(orders, (row) => n(row.tax));
  const sales = sum(invoices, (row) => n(row.subtotal));
  const costs = sum(orders, (row) => n(row.subtotal));
  return {
    columns: [col(t.rowType), col(t.documents, "number"), col(t.netAmount, "money"), col(t.vat, "money")],
    rows: [
      [t.outputVatRow, invoices.length, sales, output],
      [t.inputVatRow, orders.length, costs, input],
      [t.netVatRow, "", "", output - input],
    ],
    kpis: [
      { label: t.outputVat, value: output, money: true },
      { label: t.inputVat, value: input, money: true },
      { label: t.netVat, value: output - input, money: true },
    ],
  };
}

function payroll(data, filters, t) {
  const slips = (data.payslips || []).filter((row) => inRange(payslipDay(row), filters));
  const list = [...slips].sort((a, b) => payslipDay(b).localeCompare(payslipDay(a)) || String(a.employeeName || "").localeCompare(String(b.employeeName || "")));
  return {
    columns: [col(t.employee), col(t.month), col(t.year), col(t.basePay, "money"), col(t.overtimePay, "money"), col(t.deductions, "money"), col(t.netPay, "money"), col(t.status)],
    rows: list.map((row) => [
      row.employeeName || t.unknownParty,
      payslipMonth(row),
      payslipYear(row),
      n(row.baseSalary),
      n(row.overtimePay),
      n(row.deductions),
      n(row.netPay),
      statusLabel(row.status, t),
    ]),
    kpis: [
      { label: t.payslips, value: list.length },
      { label: t.netPay, value: sum(list, (row) => n(row.netPay)), money: true },
    ],
  };
}

export function buildReport(id, data, filters, t) {
  const invoices = filteredInvoices(data, filters);
  const orders = filteredOrders(data, filters);
  if (id === "sales-by-customer") return salesByCustomer(invoices, data, t);
  if (id === "invoice-details") return invoiceDetails(invoices, data, t);
  if (id === "customer-balance") return customerBalance(invoices, data, t);
  if (id === "payments-received") return paymentsReceived(invoices, data, t);
  if (id === "expense-details") return expenseDetails(orders, data, t);
  if (id === "vendor-balance") return vendorBalance(orders, data, t);
  if (id === "vat-audit") return vatAudit(invoices, orders, t);
  if (id === "payroll") return payroll(data, filters, t);
  return null;
}

export function periodText(filters, t) {
  const from = filters.from || t.allDates;
  const to = filters.to || t.allDates;
  return `${t.periodLabel}: ${from}  →  ${to}`;
}
