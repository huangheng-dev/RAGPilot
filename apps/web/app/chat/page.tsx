import type { Metadata } from "next";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import WorkspaceConsolePage from "@/components/workspace/WorkspaceConsolePage";

export const metadata: Metadata = {
  title: "Chat"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProtectedRoute requiredPermission="access_chat">
        <WorkspaceConsolePage activeHref="/chat" routePath="/chat" />
      </ProtectedRoute>
    </Suspense>
  );
}
