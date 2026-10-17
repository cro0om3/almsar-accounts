import PageHead from "../../components/PageHead";
import FleetBoard from "../../components/FleetBoard";
import { listVehicles } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function VehicleDashboardPage() {
  const vehicles = (await listVehicles()).map((row) => ({
    id: row.id,
    vehicleNumber: row.vehicleNumber || "",
    vehicleType: row.vehicleType || "",
    status: row.status || "",
  }));
  return (
    <>
      <PageHead title="vehicleDashboard" />
      <FleetBoard vehicles={vehicles} />
    </>
  );
}
