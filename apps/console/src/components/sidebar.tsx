"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
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
    header: "Displai",
    items: [
      {
        label: "Customers",
        href: "/customers",
        icon: <Users className="size-4" />,
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

  const initials = (session?.user?.name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <SidebarShell>
      {/* Logo */}
      <div className="h-14 px-5 flex items-center gap-3 border-b border-border shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/displai-favicon.png" alt="Omni" className="w-6 h-6 rounded-md" />
        <span className="font-semibold text-foreground text-sm tracking-tight">Omni</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 space-y-1">
        {NAV_SECTIONS.map((section) => (
          <SidebarNavSection key={section.header} label={section.header}>
            {section.items.map((item) => (
              <NavEntry key={item.href} item={item} pathname={pathname} isAdmin={isAdmin} />
            ))}
          </SidebarNavSection>
        ))}
      </nav>

      <SidebarFooter>
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors">
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
            <span className="text-foreground text-xs font-medium">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">
              {session?.user?.name ?? "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate leading-tight">
              {session?.user?.email}
            </p>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
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
            "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            isActive
              ? "bg-muted text-foreground font-medium"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <span className="w-4 h-4 flex items-center justify-center shrink-0">{item.icon}</span>
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
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          isActive
            ? "text-foreground font-medium"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <span className="w-4 h-4 flex items-center justify-center shrink-0">{item.icon}</span>
        <span className="flex-1 text-left">{item.label}</span>
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <ul className="ml-[18px] mt-0.5 flex flex-col gap-px border-l border-border pl-3">
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
            "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            childActive
              ? "bg-muted text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">{child.icon}</span>
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
          "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          childActive || anyGrandchildActive
            ? "text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        )}
      >
        <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">{child.icon}</span>
        <span className="flex-1 text-left">{child.label}</span>
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <ul className="ml-4 mt-px flex flex-col gap-px border-l border-border pl-2.5">
          {child.children!.map((gc) => {
            const gcActive = pathname === gc.href;
            return (
              <li key={gc.href + gc.label}>
                <Link
                  href={gc.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                    gcActive
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  <span className="w-3 h-3 flex items-center justify-center shrink-0">{gc.icon}</span>
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
