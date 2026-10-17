import { cookies } from "next/headers";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "../components/I18nProvider";
import Shell from "../components/Shell";
import { readSessionToken } from "../lib/access";

const latin = Inter({ subsets: ["latin"], variable: "--font-latin", display: "swap" });
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata = {
  title: "Almsar Alzaki | Accounts",
  appleWebApp: { capable: true, title: "Almsar Accounts", statusBarStyle: "black-translucent" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e2744",
};

export default async function RootLayout({ children }) {
  const jar = await cookies();
  const session = readSessionToken(jar.get("almsar_gate")?.value || "");
  return (
    <html lang="en" dir="ltr">
      <body className={`${latin.variable} ${arabic.variable}`}>
        <I18nProvider>
          <Shell session={session}>{children}</Shell>
        </I18nProvider>
      </body>
    </html>
  );
}
