import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  Settings,
  Dog,
  FileText,
  Mail,
  BarChart3
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useHealthCheck } from "@/src/hooks/useHealthCheck";

import { useAuth } from "@/src/lib/AuthContext";
import type { UserRole } from "@/src/types";

const ROLE_LEVEL: Record<UserRole, number> = {
  customer: 0,
  groomer: 1,
  receptionist: 2,
  owner: 3,
};

type NavItem = {
  name: string;
  href: string;
  icon: any;
  minRole: UserRole;
};

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, minRole: "groomer" },
  { name: "Calendar", href: "/calendar", icon: CalendarDays, minRole: "groomer" },
  { name: "Customers", href: "/customers", icon: Users, minRole: "groomer" },
  { name: "Services", href: "/services", icon: Scissors, minRole: "receptionist" },
  { name: "Forms", href: "/forms", icon: FileText, minRole: "receptionist" },
  { name: "Messaging", href: "/messaging", icon: Mail, minRole: "receptionist" },
  { name: "Reports", href: "/reports", icon: BarChart3, minRole: "owner" },
  { name: "Settings", href: "/settings", icon: Settings, minRole: "groomer" },
];

export function Sidebar({ open, setOpen }: { open?: boolean; setOpen?: (val: boolean) => void }) {
  const location = useLocation();
  const { user } = useAuth();
  const health = useHealthCheck();
  const userLevel = ROLE_LEVEL[(user?.role as UserRole) || 'groomer'] ?? 1;
  const visibleNav = navigation.filter(item => userLevel >= ROLE_LEVEL[item.minRole]);

  useEffect(() => {
    if (setOpen) setOpen(false);
  }, [location.pathname]);

  return (
    <>
      <div className={`fixed inset-0 z-20 bg-purple/60 backdrop-blur-sm transition-opacity lg:hidden ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setOpen?.(false)} />
      <div className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-purple transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"} flex flex-col`}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-md">
            <Dog className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-base font-bold tracking-tight text-white">Smarter Dog</span>
            <span className="font-accent text-xs text-white/70">Grooming Salon</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {visibleNav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 shrink-0 transition-colors",
                      isActive ? "text-accent" : "text-white/70 group-hover:text-white/90"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User section */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-white font-heading font-bold text-sm">
              {(user?.email?.charAt(0) || "U").toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white">{user?.email?.split('@')[0] || "User"}</span>
              <span className="text-xs text-white/70 capitalize">{(user as any)?.role || "Staff"}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-white/60">
            <span className={cn("h-2 w-2 rounded-full", health.status === "connected" ? "bg-emerald-400" : health.status === "disconnected" ? "bg-red-400 animate-pulse" : "bg-yellow-400")} />
            {health.status === "connected" ? "Server online" : health.status === "disconnected" ? "Server offline" : "Checking…"}
          </div>
        </div>
      </div>
    </>
  );
}
