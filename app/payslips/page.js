import PayslipDesk from "../../components/PayslipDesk";
import { listEmployees, listPayslips } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function PayslipsPage() {
  const [rows, employees] = await Promise.all([listPayslips(), listEmployees()]);
  return <PayslipDesk rows={rows} employees={employees} />;
}
