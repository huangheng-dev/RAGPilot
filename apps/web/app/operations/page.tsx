import type { Metadata } from "next";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import OperationsConsolePage from "@/components/operations/OperationsConsolePage";

export const metadata: Metadata = {
  title: "Operations"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProtectedRoute requiredPermission="access_operations">
        <OperationsConsolePage />
      </ProtectedRoute>
    </Suspense>
  );
}
