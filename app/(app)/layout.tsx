import { requireUser } from "@/lib/auth";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}
