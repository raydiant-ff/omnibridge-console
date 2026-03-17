import { Sidebar } from "@/components/sidebar";
import { AppHeader } from "@/components/app-header";
import { PageTitleProvider } from "@/components/page-title-context";
import { AppShell } from "@/components/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageTitleProvider>
      <AppShell
        sidebar={<Sidebar />}
        topBar={<AppHeader />}
      >
        {children}
      </AppShell>
    </PageTitleProvider>
  );
}
