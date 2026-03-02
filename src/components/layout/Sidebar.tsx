import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  Settings,
  Dog,
  FileText
} from "lucide-react";
import { cn } from "@/src/lib/utils";

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
  { name: "Settings", href: "/settings", icon: Settings, minRole: "groomer" },
];

export function Sidebar({ open, setOpen }: { open?: boolean; setOpen?: (val: boolean) => void }) {
  const location = useLocation();
  const { user } = useAuth();
  const userLevel = ROLE_LEVEL[(user?.role as UserRole) || 'groomer'] ?? 1;
  const visibleNav = navigation.filter(item => userLevel >= ROLE_LEVEL[item.minRole]);

  useEffect(() => {
    if (setOpen) setOpen(false);
  }, [location.pathname]);

  return (
    <>
      <div className={`fixed inset-0 z-20 bg-slate-900/50 transition-opacity lg:hidden ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`} onClick={() => setOpen?.(false)} />
      <div className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"} flex flex-col border-r border-slate-200`}>
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Dog className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">Savvy Pet Spa</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {visibleNav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 shrink-0",
                      isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-500"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 overflow-hidden rounded-full bg-slate-100">
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                alt="User avatar"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-900">{user?.email?.split('@')[0] || "User"}</span>
              <span className="text-xs text-slate-500 capitalize">{(user as any)?.role || "Staff"}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
