import "./globals.css";
import { I18nProvider } from "../components/I18nProvider";
import Shell from "../components/Shell";
import { vehicleAlerts } from "../lib/accounts";

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

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const alerts = await vehicleAlerts();
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <I18nProvider>
          <Shell alerts={alerts}>{children}</Shell>
        </I18nProvider>
      </body>
    </html>
  );
}
