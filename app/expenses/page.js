import ExpensesDesk from "../../components/ExpensesDesk";
import { expensesForDesk } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const data = await expensesForDesk();
  return <ExpensesDesk vehicles={data.vehicles} general={data.general} />;
}
