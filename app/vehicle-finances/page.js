import FinanceDesk from "../../components/FinanceDesk";
import { financesForDesk } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function VehicleFinancesPage() {
  return <FinanceDesk vehicles={await financesForDesk()} />;
}
