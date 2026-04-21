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
  Sparkles,
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
    ...(isAdmin ? [] : [{ to: "/attendance", label: "Attendance", icon: Clock }]),
  ];
  const adminItems = [
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/attendance", label: "All Attendance", icon: CalendarCheck },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center glow-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-base text-gradient">Agency PM</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
          {isAdmin && (
            <>
              <div className="pt-5 pb-2 px-3 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-semibold">
                Admin
              </div>
              {adminItems.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2.5 mb-2 rounded-lg bg-sidebar-accent/40">
            <div className="text-sm text-sidebar-primary-foreground truncate font-medium">{user?.email}</div>
            <div className="text-xs text-sidebar-foreground/60 mt-0.5">
              {isAdmin ? "✦ Administrator" : "Member"}
            </div>
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
        <header className="md:hidden h-14 flex items-center justify-between px-4 border-b border-border bg-card/70 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-gradient-primary flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-gradient">Agency PM</span>
          </div>
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
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative group",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-glow"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-gradient-primary rounded-r-full" />}
          <Icon className="h-4 w-4" />
          <span className="font-medium">{label}</span>
        </>
      )}
    </NavLink>
  );
}
