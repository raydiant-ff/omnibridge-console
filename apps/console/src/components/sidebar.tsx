"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  TrendingDown,
  XCircle,
  RotateCw,
  LogOut,
  List,
  Package,
  LayoutDashboard,
  HeartHandshake,
  FilePlus,
  ArrowUpRight,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavGrandchild {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavChild {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  exact?: boolean;
  children?: NavGrandchild[];
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
      {
        label: "Create",
        href: "/quotes/create",
        icon: <Plus className="size-3.5" />,
        children: [
          { label: "New", href: "/quotes/create", icon: <FilePlus className="size-3" /> },
          { label: "Expansion", href: "/quotes/create/expansion", icon: <ArrowUpRight className="size-3" /> },
          { label: "Renewal", href: "/quotes/create/renewal", icon: <RotateCw className="size-3" /> },
          { label: "Amendment", href: "/quotes/create/amendment", icon: <PenLine className="size-3" /> },
        ],
      },
    ],
  },
  {
    label: "Products",
    href: "/products",
    icon: <Package className="size-4" />,
    children: [
      { label: "Products", href: "/products", icon: <Package className="size-3.5" />, exact: true },
      { label: "Coupons", href: "/coupons", icon: <Ticket className="size-3.5" /> },
    ],
  },
  {
    label: "Subscriptions",
    href: "/subscriptions",
    icon: <RefreshCw className="size-4" />,
    children: [
      { label: "Dashboard", href: "/subscriptions", icon: <LayoutDashboard className="size-3.5" />, exact: true },
      { label: "Create", href: "/subscriptions/create", icon: <Plus className="size-3.5" /> },
    ],
  },
  {
    label: "Customer Success",
    href: "/cs",
    icon: <HeartHandshake className="size-4" />,
    children: [
      { label: "Dashboard", href: "/cs", icon: <LayoutDashboard className="size-3.5" />, exact: true },
      { label: "Renewals", href: "/cs/renewals", icon: <RotateCw className="size-3.5" /> },
      { label: "Amendments", href: "/cs/amendments", icon: <PenLine className="size-3.5" /> },
      { label: "Downgrades", href: "/cs/downgrades", icon: <TrendingDown className="size-3.5" /> },
      { label: "Cancellations", href: "/cs/cancellations", icon: <XCircle className="size-3.5" /> },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r bg-card/50">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/displai-logo.svg" alt="Displai" className="h-6 w-auto" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavEntry key={item.href} item={item} pathname={pathname} isAdmin={isAdmin} />
          ))}
        </ul>
      </nav>

      <div className="border-t bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
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
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="size-3.5" />
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
          className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            isActive
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
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
        className={`flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        }`}
      >
        {item.icon}
        <span className="flex-1 text-left">{item.label}</span>
        {expanded ? (
          <ChevronDown className="size-3.5 opacity-50" />
        ) : (
          <ChevronRight className="size-3.5 opacity-50" />
        )}
      </button>

      {expanded && (
        <ul className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border/50 pl-3">
          {visibleChildren!.map((child) => (
            <NavChildEntry key={child.href + child.label} child={child} pathname={pathname} />
          ))}
        </ul>
      )}
    </li>
  );
}

function NavChildEntry({ child, pathname }: { child: NavChild; pathname: string }) {
  const router = useRouter();
  const childActive = child.exact
    ? pathname === child.href
    : pathname === child.href || pathname.startsWith(child.href + "/");
  const hasGrandchildren = child.children && child.children.length > 0;

  const anyGrandchildActive = hasGrandchildren &&
    child.children!.some((gc) => pathname === gc.href || pathname.startsWith(gc.href + "/"));
  const [expanded, setExpanded] = useState(childActive || anyGrandchildActive);

  if (!hasGrandchildren) {
    return (
      <li>
        <Link
          href={child.href}
          className={`flex items-center gap-2 rounded-md px-2.5 py-1 text-sm transition-colors ${
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
  }

  const handleClick = () => {
    if (!expanded) {
      setExpanded(true);
      const firstChild = child.children![0];
      if (firstChild && pathname !== firstChild.href) {
        router.push(firstChild.href);
      }
    } else {
      setExpanded(false);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-sm transition-colors ${
          childActive || anyGrandchildActive
            ? "font-medium text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {child.icon}
        <span className="flex-1 text-left">{child.label}</span>
        {expanded ? (
          <ChevronDown className="size-3 opacity-50" />
        ) : (
          <ChevronRight className="size-3 opacity-50" />
        )}
      </button>

      {expanded && (
        <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-border/50 pl-2.5">
          {child.children!.map((gc) => {
            const gcActive = pathname === gc.href;
            return (
              <li key={gc.href + gc.label}>
                <Link
                  href={gc.href}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                    gcActive
                      ? "font-medium text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {gc.icon}
                  {gc.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
