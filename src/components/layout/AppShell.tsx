import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  Users,
  CalendarCheck,
  LogOut,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/attendance", label: "Attendance", icon: Clock },
  ];
  const adminItems = [
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/attendance", label: "All Attendance", icon: CalendarCheck },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center">
            <Briefcase className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-primary-foreground">Agency PM</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          {isAdmin && (
            <>
              <div className="pt-4 pb-1 px-3 text-xs uppercase tracking-wider text-sidebar-foreground/50">
                Admin
              </div>
              {adminItems.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-2">
            <div className="text-sm text-sidebar-primary-foreground truncate">{user?.email}</div>
            <div className="text-xs text-sidebar-foreground/60">{isAdmin ? "Administrator" : "Member"}</div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-border bg-card">
          <span className="font-semibold">Agency PM</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: any }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
        )
      }
    >
      <Icon className="h-4 w-4" />
      {label}
    </NavLink>
  );
}
