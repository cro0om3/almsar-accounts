import MasterDesk from "../../components/MasterDesk";
import { listVehicles } from "../../lib/accounts";

export const dynamic = "force-dynamic";

const fields = [
  { key: "vehicleType", label: "vehicleType" },
  { key: "vehicleNumber", label: "vehicleNumber" },
  { key: "category", label: "vehicleCategory" },
  { key: "year", label: "yearMade", number: true },
  { key: "color", label: "color" },
  { key: "chassisNumber", label: "chassisNumber" },
  { key: "ownershipExpiry", label: "ownershipExpiry", date: true },
  { key: "insuranceExpiry", label: "insuranceExpiry", date: true },
  { key: "notes", label: "notes", long: true },
  { key: "ownershipPath", label: "ownershipFront", file: true, folder: "ownership" },
  { key: "ownershipBackPath", label: "ownershipBack", file: true, folder: "ownership" },
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
