"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import {
  Briefcase,
  FileText,
  Ticket,
  RefreshCw,
  Users,
  ChevronDown,
  ChevronRight,
  Plus,
  TrendingUp,
  ArrowLeftRight,
  TrendingDown,
  XCircle,
  RotateCw,
  LogOut,
  List,
  Package,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavChild {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  exact?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Customers",
    href: "/customers",
    icon: <Users className="size-4" />,
  },
  {
    label: "Products",
    href: "/products",
    icon: <Package className="size-4" />,
  },
  {
    label: "Opportunities",
    href: "/opportunities",
    icon: <Briefcase className="size-4" />,
    children: [
      { label: "Dashboard", href: "/opportunities", icon: <LayoutDashboard className="size-3.5" />, exact: true },
      { label: "My Opportunities", href: "/opportunities/my", icon: <List className="size-3.5" /> },
      { label: "All Opportunities", href: "/opportunities/all", icon: <Users className="size-3.5" />, adminOnly: true },
      { label: "Create", href: "/opportunities/create", icon: <Plus className="size-3.5" /> },
    ],
  },
  {
    label: "Quotes",
    href: "/quotes",
    icon: <FileText className="size-4" />,
    children: [
      { label: "My Quotes", href: "/quotes", icon: <List className="size-3.5" />, exact: true },
      { label: "All Quotes", href: "/quotes/all", icon: <Users className="size-3.5" />, adminOnly: true },
      { label: "Create", href: "/quotes/create", icon: <Plus className="size-3.5" /> },
    ],
  },
  {
    label: "Coupons",
    href: "/coupons",
    icon: <Ticket className="size-4" />,
  },
  {
    label: "Subscriptions",
    href: "/subscriptions",
    icon: <RefreshCw className="size-4" />,
    children: [
      { label: "Create", href: "/subscriptions/create", icon: <Plus className="size-3.5" /> },
      { label: "Upsell", href: "/subscriptions/upsell", icon: <TrendingUp className="size-3.5" /> },
      { label: "Cross-sell", href: "/subscriptions/cross-sell", icon: <ArrowLeftRight className="size-3.5" /> },
      { label: "Downgrade", href: "/subscriptions/downgrade", icon: <TrendingDown className="size-3.5" /> },
      { label: "Cancellation", href: "/subscriptions/cancellation", icon: <XCircle className="size-3.5" /> },
      { label: "Renewal", href: "/subscriptions/renewal", icon: <RotateCw className="size-3.5" /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/displai-logo.svg" alt="Displai" className="h-6 w-auto" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavEntry key={item.href} item={item} pathname={pathname} isAdmin={isAdmin} />
          ))}
        </ul>
      </nav>

      <div className="border-t px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {session?.user?.name ?? "User"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {session?.user?.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

function NavEntry({ item, pathname, isAdmin }: { item: NavItem; pathname: string; isAdmin: boolean }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
  const visibleChildren = item.children?.filter((c) => !c.adminOnly || isAdmin);
  const hasChildren = visibleChildren && visibleChildren.length > 0;
  const [expanded, setExpanded] = useState(isActive);

  if (!hasChildren) {
    return (
      <li>
        <Link
          href={item.href}
          className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
            isActive
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {item.icon}
        <span className="flex-1 text-left">{item.label}</span>
        {expanded ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
      </button>

      {expanded && (
        <ul className="ml-4 mt-1 flex flex-col gap-0.5 border-l pl-3">
          {visibleChildren!.map((child) => {
            const childActive = child.exact
              ? pathname === child.href
              : pathname === child.href || pathname.startsWith(child.href + "/");
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                    childActive
                      ? "font-medium text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {child.icon}
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
