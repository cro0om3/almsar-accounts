import PayslipDesk from "../../components/PayslipDesk";
import { listEmployees, listPayslips } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function PayslipsPage() {
  return <PayslipDesk rows={await listPayslips()} employees={await listEmployees()} />;
}
