import MasterDesk from "../../components/MasterDesk";
import { listEmployees } from "../../lib/accounts";

export const dynamic = "force-dynamic";

const fields = [
  { key: "name", label: "name" },
  { key: "employeeId", label: "employeeId" },
  { key: "role", label: "role" },
  { key: "paymentType", label: "paymentType" },
  { key: "hourlyRate", label: "hourlyRate", number: true },
  { key: "salary", label: "salary", number: true },
  { key: "overtimeRate", label: "overtimeRate", number: true },
  { key: "bankDetails", label: "bankDetails", long: true },
];

export default function EmployeesPage() {
  return <MasterDesk kind="employees" titleKey="employees" rows={listEmployees()} fields={fields} labelKey="name" />;
}
