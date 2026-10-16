import MasterDesk from "../../components/MasterDesk";
import { listCustomers } from "../../lib/accounts";

export const dynamic = "force-dynamic";

const fields = [
  { key: "name", label: "name" },
  { key: "company", label: "company" },
  { key: "email", label: "email" },
  { key: "phone", label: "phone" },
  { key: "address", label: "address", long: true },
  { key: "trn", label: "trn" },
];

export default function CustomersPage() {
  return <MasterDesk kind="customers" titleKey="customers" rows={listCustomers()} fields={fields} labelKey="name" />;
}
