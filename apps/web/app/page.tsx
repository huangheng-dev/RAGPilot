import type { Metadata } from "next";
import { Suspense } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import HomePage from "@/components/home/HomePage";

export const metadata: Metadata = {
  title: "Home"
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProtectedRoute requiredPermission="access_home">
        <HomePage />
      </ProtectedRoute>
    </Suspense>
  );
}
