import type { Metadata } from "next";
import { Suspense } from "react";

import AccessControlConsolePage from "@/components/access-control/AccessControlConsolePage";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export const metadata: Metadata = { title: "Access Control" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProtectedRoute allowedRoles={["super_admin"]} requiredPermission="manage_admin_resources">
        <AccessControlConsolePage />
      </ProtectedRoute>
    </Suspense>
  );
}
