import SettingsForm from "../../components/SettingsForm";
import { getSettings } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <SettingsForm settings={getSettings()} />;
}
