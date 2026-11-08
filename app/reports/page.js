import ReportsView from "../../components/ReportsView";
import { getSettings, listCustomers, listInvoices, listPayslips, listPurchaseOrders, listVendors } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [invoices, customers, vendors, purchaseOrders, payslips, settings] = await Promise.all([
    listInvoices(),
    listCustomers(),
    listVendors(),
    listPurchaseOrders(),
    listPayslips(),
    getSettings(),
  ]);
  return (
    <ReportsView
      data={{ invoices, customers, vendors, purchaseOrders, payslips }}
      settings={{
        companyName: settings.companyName || "",
        companyNameArabic: settings.companyNameArabic || "",
        address: settings.address || "",
        vatNumber: settings.vatNumber || "",
        email: settings.email || "",
        website: settings.website || "",
        footerAddressEnglish: settings.footerAddressEnglish || "",
        footerContactEnglish: settings.footerContactEnglish || "",
        currency: settings.currency || "AED",
      }}
    />
  );
}
