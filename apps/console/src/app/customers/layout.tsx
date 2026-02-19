import Link from "next/link";

export default function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            OmniBridge
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/customers" className="hover:text-foreground transition-colors">
              Customers
            </Link>
            <Link href="/workflows/create-subscription" className="hover:text-foreground transition-colors">
              Workflows
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
