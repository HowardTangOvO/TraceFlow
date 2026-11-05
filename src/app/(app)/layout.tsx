import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { toViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const viewer = toViewer(user);

  return (
    <div className="min-h-dvh">
      <Sidebar viewer={viewer} />
      <div className="lg:pl-[248px]">
        <Topbar user={user} />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-7 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
