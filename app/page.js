import Dashboard from "../components/Dashboard";
import { dashboard } from "../lib/accounts";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <Dashboard data={dashboard()} />;
}
