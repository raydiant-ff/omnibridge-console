import { SidebarProvider } from "@/components/ui/sidebar";
import { OmniTopBar } from "@/components/omni/omni-top-bar";

// --header-height covers both the global OmniTopBar (h-10 = 40px)
// and the per-page PageHeader (h-10 = 40px) = 80px total.
// The per-page Sidebar uses top-(--header-height) to offset below both bars.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="[--header-height:calc(--spacing(20))]">
      <OmniTopBar />
      <SidebarProvider className="flex flex-col">
        {children}
      </SidebarProvider>
    </div>
  );
}
