import Dashboard from "../components/Dashboard";
import { dashboard } from "../lib/accounts";
import { readSessionToken } from "../lib/access";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const jar = await cookies();
  const session = readSessionToken(jar.get("almsar_gate")?.value || "");
  return <Dashboard data={await dashboard()} session={session} />;
}
