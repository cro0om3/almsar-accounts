import { vehicleAlerts } from "../../../lib/accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await vehicleAlerts());
}
