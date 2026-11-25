import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/auth/guard";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getStaffUser()) redirect("/admin/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <LoginForm isDev={process.env.NODE_ENV === "development"} />
    </main>
  );
}
