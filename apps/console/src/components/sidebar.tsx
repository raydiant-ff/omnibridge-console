"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  FileText,
  FileCheck2,
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
  LayoutDashboard,
  HeartHandshake,
  FilePlus,
  ArrowUpRight,
  PenLine,
  BarChart3,
  Search,
  ShieldAlert,
  ClipboardList,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { SidebarShell, SidebarNavSection, SidebarFooter } from "@/components/shell";


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

interface NavSection {
  header: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    header: "Operations",
    items: [
      {
        label: "Customers",
        href: "/customers",
        icon: <Users className="size-4" />,
      },
      {
        label: "Support",
        href: "/support",
        icon: <MessagesSquare className="size-4" />,
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
          { label: "CS Queue", href: "/cs/queue", icon: <ClipboardList className="size-3.5" /> },
          { label: "Data Quality", href: "/cs/data-quality", icon: <ShieldAlert className="size-3.5" /> },
          { label: "Reports", href: "/cs/reports", icon: <BarChart3 className="size-3.5" /> },
        ],
      },
    ],
  },
  {
    header: "Salesforce",
    items: [
      {
        label: "Opportunities",
        href: "/opportunities",
        icon: <Briefcase className="size-4" />,
        children: [
          { label: "Dashboard", href: "/opportunities", icon: <LayoutDashboard className="size-3.5" />, exact: true },
          { label: "All Opportunities", href: "/opportunities/all", icon: <Users className="size-3.5" />, adminOnly: true },
          { label: "My Opportunities", href: "/opportunities/my", icon: <List className="size-3.5" /> },
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
        label: "Coupons",
        href: "/coupons",
        icon: <Ticket className="size-4" />,
      },
      {
        label: "Contracts",
        href: "/contracts",
        icon: <FileCheck2 className="size-4" />,
      },
    ],
  },
  {
    header: "Stripe",
    items: [
      {
        label: "Subscriptions",
        href: "/subscriptions",
        icon: <RefreshCw className="size-4" />,
        children: [
          { label: "Dashboard", href: "/subscriptions", icon: <LayoutDashboard className="size-3.5" />, exact: true },
          { label: "Scrub", href: "/subscriptions/scrub", icon: <Search className="size-3.5" /> },
          { label: "Create", href: "/subscriptions/create", icon: <Plus className="size-3.5" /> },
        ],
      },
      // Invoices, Payments, Payment Methods: scaffold routes removed from nav.
      // Pages exist but are not product-ready. Re-add when wired to projection layer.
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const compactMode = pathname.startsWith("/support");
  const [collapsed, setCollapsed] = useState(compactMode);

  useEffect(() => {
    setCollapsed(compactMode);
  }, [compactMode]);

  const displayName = session?.user?.name ?? "Admin User";
  const displayEmail = session?.user?.email ?? "admin@yourcompany.com";

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const compactItems = NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      href: item.href,
      label: item.label,
      icon: item.icon,
      active: pathname === item.href || pathname.startsWith(item.href + "/"),
    })),
  );

  return (
    <SidebarShell collapsed={collapsed}>
      {/* Logo */}
      <div
        className={cn(
          "h-16 border-b border-sidebar-border shrink-0",
          collapsed ? "px-3 flex items-center justify-center" : "px-5 flex items-center gap-3",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/displai-favicon.png" alt="Omni" className="w-7 h-7 rounded-lg" />
        {!collapsed && (
          <span className="font-semibold text-sidebar-foreground text-[19px] tracking-tight">Omni</span>
        )}
        {compactMode && (
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className={cn(
              "rounded-xl border border-sidebar-border bg-sidebar-accent/55 p-2 text-muted-foreground transition-colors hover:bg-sidebar hover:text-foreground",
              collapsed ? "absolute top-4 right-3" : "ml-auto",
            )}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        )}
      </div>

      {compactMode && collapsed ? (
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="flex flex-col items-center gap-2 px-2">
            {compactItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "flex size-11 items-center justify-center rounded-2xl border transition-colors",
                  item.active
                    ? "border-primary/20 bg-primary/6 text-foreground"
                    : "border-transparent text-muted-foreground hover:border-sidebar-border hover:bg-sidebar-accent/45 hover:text-foreground",
                )}
              >
                <span className="flex size-5 items-center justify-center">{item.icon}</span>
              </Link>
            ))}
          </div>
        </nav>
      ) : (
        <nav className="flex-1 overflow-y-auto py-4 space-y-1">
          {NAV_SECTIONS.map((section) => (
            <SidebarNavSection key={section.header} label={section.header}>
              {section.items.map((item) => (
                <NavEntry key={item.href} item={item} pathname={pathname} isAdmin={isAdmin} />
              ))}
            </SidebarNavSection>
          ))}
        </nav>
      )}

      <SidebarFooter>
        {compactMode && collapsed ? (
          <div className="flex justify-center">
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-2xl border border-sidebar-border bg-sidebar-accent/55 transition-colors hover:bg-sidebar"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title={displayName}
            >
              <span className="text-foreground text-[13px] font-semibold">{initials}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/55 px-3.5 py-3.5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] transition-colors">
            <div className="w-9 h-9 rounded-xl border border-sidebar-border/80 bg-sidebar flex items-center justify-center shrink-0">
              <span className="text-foreground text-[13px] font-semibold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-foreground truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[12px] text-muted-foreground truncate leading-tight">
                {displayEmail}
              </p>
            </div>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-sidebar transition-colors"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </SidebarShell>
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
          className={cn(
            "relative w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] font-medium transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            isActive
              ? "bg-sidebar text-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/45 hover:text-foreground",
          )}
        >
          <span className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</span>
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
        className={cn(
          "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[15px] font-medium transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          isActive
            ? "bg-sidebar text-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/45 hover:text-foreground",
        )}
      >
        <span className="w-5 h-5 flex items-center justify-center shrink-0">{item.icon}</span>
        <span className="flex-1 text-left">{item.label}</span>
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <ul className="ml-5 mt-1 flex flex-col gap-1 border-l border-sidebar-border/80 pl-3.5">
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
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition-colors",
            childActive
              ? "bg-sidebar text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/45",
          )}
        >
          <span className="w-4 h-4 flex items-center justify-center shrink-0">{child.icon}</span>
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
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition-colors",
          childActive || anyGrandchildActive
            ? "bg-sidebar text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/45",
        )}
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0">{child.icon}</span>
        <span className="flex-1 text-left">{child.label}</span>
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <ul className="ml-5 mt-1 flex flex-col gap-1 border-l border-sidebar-border/80 pl-3">
          {child.children!.map((gc) => {
            const gcActive = pathname === gc.href;
            return (
              <li key={gc.href + gc.label}>
                <Link
                  href={gc.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                    gcActive
                      ? "bg-sidebar text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/40",
                  )}
                >
                  <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">{gc.icon}</span>
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
