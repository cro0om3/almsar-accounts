import MasterDesk from "../../components/MasterDesk";
import { listEmployees } from "../../lib/accounts";

export const dynamic = "force-dynamic";

const fields = [
  { key: "name", label: "name" },
  { key: "employeeId", label: "employeeId" },
  { key: "idExpiry", label: "idExpiry", date: true },
  { key: "role", label: "role" },
  { key: "paymentType", label: "paymentType" },
  { key: "hourlyRate", label: "hourlyRate", number: true },
  { key: "salary", label: "salary", number: true },
  { key: "overtimeRate", label: "overtimeRate", number: true },
  { key: "bankDetails", label: "bankDetails", long: true },
  { key: "idPath", label: "emiratesIdPhoto", file: true, folder: "employee-files" },
  { key: "passportPath", label: "passportPhoto", file: true, folder: "employee-files" },
  { key: "licensePath", label: "employeeLicense", file: true, folder: "employee-files" },
];

export default async function EmployeesPage() {
  return <MasterDesk kind="employees" titleKey="employees" rows={await listEmployees()} fields={fields} labelKey="name" />;
}
