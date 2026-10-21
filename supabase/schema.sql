-- Supabase schema for the Almsar accounts app.
-- Apply this in the Supabase SQL editor when the project is created.
-- Staff who are signed in can read and write every row. Anonymous visitors cannot.

create table if not exists customers (
  id text primary key,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  trn text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

create table if not exists vendors (
  id text primary key,
  name text not null,
  "contactPerson" text,
  email text,
  phone text,
  address text,
  "bankDetails" text,
  "paymentTerms" text,
  "createdAt" timestamptz
);

create table if not exists employees (
  id text primary key,
  name text not null,
  "employeeId" text,
  role text,
  "paymentType" text,
  "hourlyRate" double precision,
  salary double precision,
  "overtimeRate" double precision,
  "bankDetails" text,
  "idExpiry" text,
  "idPath" text,
  "passportPath" text,
  "licensePath" text,
  "createdAt" timestamptz
);

create table if not exists vehicles (
  id text primary key,
  "vehicleNumber" text not null unique,
  "vehicleType" text,
  make text,
  model text,
  year integer,
  description text,
  "basePrice" double precision,
  status text default 'active',
  "createdAt" timestamptz
);

create table if not exists quotes (
  id text primary key,
  number text not null,
  date text not null,
  currency text default 'AED',
  "customerId" text references customers(id),
  "subTotal" double precision,
  "totalTax" double precision,
  total double precision,
  notes text,
  terms text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

create table if not exists quote_items (
  id text primary key,
  "quoteId" text not null references quotes(id) on delete cascade,
  "vehicleTypeId" text,
  "vehicleTypeLabel" text,
  "vehicleNumber" text,
  description text,
  "rentalBasis" text,
  "serialNumber" integer,
  quantity double precision,
  "unitPrice" double precision,
  "taxPercent" double precision,
  "grossAmount" double precision,
  "lineTaxAmount" double precision,
  "lineTotal" double precision
);

create table if not exists invoices (
  id text primary key,
  number text not null,
  date text not null,
  duration text,
  "customerId" text references customers(id),
  "quoteId" text references quotes(id),
  "poNumbers" text,
  subtotal double precision,
  tax double precision,
  total double precision,
  "amountReceived" double precision default 0,
  status text default 'draft',
  notes text,
  terms text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

create table if not exists invoice_items (
  id text primary key,
  "invoiceId" text not null references invoices(id) on delete cascade,
  "serialNumber" integer,
  "vehicleTypeId" text,
  "vehicleTypeLabel" text,
  "vehicleNumber" text,
  description text,
  "rentalBasis" text,
  quantity double precision,
  "unitPrice" double precision,
  "taxPercent" double precision,
  tax double precision,
  "grossAmount" double precision,
  "lineTaxAmount" double precision,
  "lineTotal" double precision,
  total double precision,
  "amountReceived" double precision
);

alter table vehicles add column if not exists category text;
alter table vehicles add column if not exists notes text;
alter table vehicles add column if not exists "registrationExpiry" text;
alter table vehicles add column if not exists "ownershipExpiry" text;
alter table vehicles add column if not exists "ownershipPath" text;
alter table quotes add column if not exists status text default 'draft';

create table if not exists admin_settings (
  id text primary key,
  "companyName" text,
  address text,
  "vatNumber" text,
  "footerContactEnglish" text,
  "footerAddressEnglish" text,
  currency text,
  "defaultTerms" text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

create table if not exists purchase_orders (
  id text primary key,
  number text,
  date text,
  "vendorId" text references vendors(id),
  subtotal double precision,
  tax double precision,
  amount double precision,
  currency text default 'AED',
  status text,
  terms text,
  notes text,
  "createdAt" timestamptz
);

create table if not exists po_items (
  id text primary key,
  "purchaseOrderId" text not null references purchase_orders(id) on delete cascade,
  "serialNumber" integer,
  "vehicleTypeId" text,
  "vehicleTypeLabel" text,
  "vehicleNumber" text,
  description text,
  "rentalBasis" text,
  quantity double precision,
  "unitPrice" double precision,
  "taxPercent" double precision,
  "grossAmount" double precision,
  "lineTaxAmount" double precision,
  "lineTotal" double precision,
  total double precision
);

create table if not exists payslips (
  id text primary key,
  month text,
  year integer,
  "employeeId" text references employees(id),
  "baseSalary" double precision,
  "overtimeHours" double precision,
  "overtimeRate" double precision,
  "overtimePay" double precision,
  deductions double precision,
  "deductionRemarks" text,
  "netPay" double precision,
  status text,
  notes text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

create table if not exists vehicle_transactions (
  id text primary key,
  "vehicleId" text,
  "employeeId" text,
  "transactionType" text,
  category text,
  amount double precision,
  date text,
  month text,
  description text,
  notes text,
  "receiptPath" text,
  "createdAt" timestamptz,
  "updatedAt" timestamptz
);

alter table admin_settings enable row level security;
alter table purchase_orders enable row level security;
alter table po_items enable row level security;
alter table payslips enable row level security;
alter table vehicle_transactions enable row level security;

alter table customers enable row level security;
alter table vendors enable row level security;
alter table employees enable row level security;
alter table vehicles enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'customers','vendors','employees','vehicles','quotes','quote_items','invoices','invoice_items',
    'admin_settings','purchase_orders','po_items','payslips','vehicle_transactions'
  ]
  loop
    execute format('drop policy if exists staff_all on %I', tbl);
    execute format(
      'create policy staff_all on %I for all to authenticated using (true) with check (true)',
      tbl
    );
  end loop;
end $$;
