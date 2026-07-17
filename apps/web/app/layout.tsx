import type { Metadata } from "next";
import "./globals.css";
import { ChunkRecoveryProvider } from "@/components/app/ChunkRecoveryProvider";
import { AuthProvider } from "@/lib/auth/provider";
import { I18nProvider } from "@/lib/i18n/provider";
import { NotificationProvider } from "@/lib/notifications/provider";
import { PreferencesProvider } from "@/lib/preferences/provider";

export const metadata: Metadata = {
  title: {
    default: "RAGPilot",
    template: "%s | RAGPilot"
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
          <ChunkRecoveryProvider>
            <I18nProvider>
              <NotificationProvider>
                <AuthProvider>{children}</AuthProvider>
              </NotificationProvider>
            </I18nProvider>
          </ChunkRecoveryProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
