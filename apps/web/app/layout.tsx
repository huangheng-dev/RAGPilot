import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/provider";
import { I18nProvider } from "@/lib/i18n/provider";
import { PreferencesProvider } from "@/lib/preferences/provider";

export const metadata: Metadata = {
  title: {
    default: "RagPilot",
    template: "%s | RagPilot"
  },
  description: "Production-ready open-source RAG and agent platform"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <PreferencesProvider>
          <I18nProvider>
            <AuthProvider>{children}</AuthProvider>
          </I18nProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
