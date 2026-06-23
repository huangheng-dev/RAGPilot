import type { Metadata } from "next";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import AdminConsolePage from "@/components/admin/AdminConsolePage";

export const metadata: Metadata = {
  title: "Admin"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProtectedRoute allowedRoles={["super_admin", "reviewer"]} requiredPermission="access_admin_console">
        <AdminConsolePage />
      </ProtectedRoute>
    </Suspense>
  );
}
