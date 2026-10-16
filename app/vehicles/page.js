import MasterDesk from "../../components/MasterDesk";
import { listVehicles } from "../../lib/accounts";

export const dynamic = "force-dynamic";

const fields = [
  { key: "vehicleNumber", label: "vehicle" },
  { key: "vehicleType", label: "description" },
  { key: "make", label: "make" },
  { key: "model", label: "model" },
  { key: "year", label: "year", number: true },
  { key: "color", label: "color" },
  { key: "status", label: "status" },
  { key: "basePrice", label: "basePrice", number: true },
  { key: "description", label: "description", long: true },
  { key: "notes", label: "notes", long: true },
];

export default function VehiclesPage() {
  return <MasterDesk kind="vehicles" titleKey="vehicles" rows={listVehicles()} fields={fields} labelKey="vehicleNumber" />;
}
