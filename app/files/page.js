import CompanyFiles from "../../components/CompanyFiles";
import { listCompanyFiles } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  return (
    <div className="desk-page">
      <section className="panel master-form" style={{ margin: 22 }}>
        <CompanyFiles files={await listCompanyFiles()} heading />
      </section>
    </div>
  );
}
