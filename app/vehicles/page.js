import MasterDesk from "../../components/MasterDesk";
import { listVehicles } from "../../lib/accounts";

export const dynamic = "force-dynamic";

const fields = [
  { key: "vehicleType", label: "vehicleType" },
  { key: "vehicleNumber", label: "vehicleNumber" },
  { key: "category", label: "vehicleCategory" },
  { key: "year", label: "yearMade", number: true },
  { key: "notes", label: "notes", long: true },
  { key: "ownershipExpiry", label: "ownershipExpiry", date: true },
  { key: "ownershipPath", label: "ownershipPhoto", file: true },
];

export default async function VehiclesPage({ searchParams }) {
  const query = await searchParams;
  return (
    <MasterDesk
      kind="vehicles"
      titleKey="vehicles"
      rows={(await listVehicles()).map((row) => ({
        ...row,
        ownershipExpiry: row.ownershipExpiry || row.registrationExpiry || "",
      }))}
      fields={fields}
      labelKey="vehicleNumber"
      initialId={query.id || ""}
    />
  );
}
