import SettingsForm from "../../components/SettingsForm";
import { listStaff } from "../../lib/access";
import { getSettings, listCompanyFiles } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, files, staff] = await Promise.all([getSettings(), listCompanyFiles(), listStaff()]);
  return <SettingsForm settings={settings} files={files} staff={staff} />;
}
