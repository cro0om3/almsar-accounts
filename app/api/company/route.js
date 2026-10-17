import { getSettings } from "../../../lib/accounts";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const settings = await getSettings();
  const origin = new URL(request.url).origin;
  const admin = {
    companyName: settings.companyName,
    companyNameArabic: settings.companyNameArabic,
    tagline: settings.tagline,
    headerNote: settings.headerNote,
    address: settings.address,
    vatNumber: settings.vatNumber,
    email: settings.email,
    website: settings.website,
    footerAddressEnglish: settings.footerAddressEnglish,
    footerContactEnglish: settings.footerContactEnglish,
  };
  return Response.json({
    admin,
    branding: {
      logoUrl: `${origin}/api/branding/logo`,
      sealUrl: `${origin}/api/branding/seal`,
      signatureUrl: `${origin}/api/branding/signature`,
    },
  });
}
