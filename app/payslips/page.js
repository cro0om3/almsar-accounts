import PayslipDesk from "../../components/PayslipDesk";
import { listEmployees, listPayslips } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default function PayslipsPage() {
  return <PayslipDesk rows={listPayslips()} employees={listEmployees()} />;
}
