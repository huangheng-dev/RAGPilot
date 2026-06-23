import { Suspense } from "react";
import { LoginPage } from "@/components/auth/LoginPage";

export default function LoginRoutePage() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
