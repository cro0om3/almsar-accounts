import MasterDesk from "../../components/MasterDesk";
import { listVendors } from "../../lib/accounts";

export const dynamic = "force-dynamic";

const fields = [
  { key: "name", label: "name" },
  { key: "contactPerson", label: "contactPerson" },
  { key: "email", label: "email" },
  { key: "phone", label: "phone" },
  { key: "address", label: "address", long: true },
  { key: "bankDetails", label: "bankDetails", long: true },
  { key: "paymentTerms", label: "paymentTerms" },
];

export default async function VendorsPage() {
  return <MasterDesk kind="vendors" titleKey="vendors" rows={await listVendors()} fields={fields} labelKey="name" />;
}
