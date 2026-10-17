import MasterDesk from "../../components/MasterDesk";
import { listVehicles } from "../../lib/accounts";

export const dynamic = "force-dynamic";

const CATEGORIES = ["pickup", "truck", "tanker", "trailer", "bus", "bobcat", "jcb", "excavator", "fleet"];

const fields = [
  { key: "vehicleType", label: "vehicleType" },
  { key: "vehicleNumber", label: "vehicleNumber" },
  { key: "category", label: "vehicleCategory", options: CATEGORIES },
  { key: "year", label: "yearMade", number: true },
  { key: "notes", label: "notes", long: true },
  { key: "registrationExpiry", label: "vehicleExpiry", date: true },
  { key: "ownershipExpiry", label: "ownershipExpiry", date: true },
  { key: "ownershipPath", label: "ownershipPhoto", file: true },
];

export default async function VehiclesPage({ searchParams }) {
  const query = await searchParams;
  return (
    <MasterDesk
      kind="vehicles"
      titleKey="vehicles"
      rows={await listVehicles()}
      fields={fields}
      labelKey="vehicleNumber"
      initialId={query.id || ""}
    />
  );
}
