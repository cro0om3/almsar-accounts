import Dashboard from "../components/Dashboard";
import { dashboard } from "../lib/accounts";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return <Dashboard data={await dashboard()} />;
}
