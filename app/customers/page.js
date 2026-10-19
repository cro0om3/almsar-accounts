import MasterDesk from "../../components/MasterDesk";
import { listCustomers } from "../../lib/accounts";

export const dynamic = "force-dynamic";

const fields = [
  { key: "company", label: "company" },
  { key: "name", label: "contactPerson" },
  { key: "email", label: "email" },
  { key: "phone", label: "phone" },
  { key: "address", label: "address", long: true },
  { key: "trn", label: "trn" },
];

export default async function CustomersPage() {
  return <MasterDesk kind="customers" titleKey="customers" rows={await listCustomers()} fields={fields} labelKey="company" />;
}
