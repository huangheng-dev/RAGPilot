import type { Metadata } from "next";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import SettingsConsolePage from "@/components/settings/SettingsConsolePage";

export const metadata: Metadata = {
  title: "System Settings"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProtectedRoute requiredPermission="access_settings">
        <SettingsConsolePage />
      </ProtectedRoute>
    </Suspense>
  );
}
