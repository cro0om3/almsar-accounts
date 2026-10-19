import CompanyFiles from "../../components/CompanyFiles";
import { listCompanyFiles } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  return (
    <div className="files-screen">
      <CompanyFiles files={await listCompanyFiles()} heading />
    </div>
  );
}
