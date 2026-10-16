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
    'customers','vendors','employees','vehicles','quotes','quote_items','invoices','invoice_items'
  ]
  loop
    execute format('drop policy if exists staff_all on %I', tbl);
    execute format(
      'create policy staff_all on %I for all to authenticated using (true) with check (true)',
      tbl
    );
  end loop;
end $$;
