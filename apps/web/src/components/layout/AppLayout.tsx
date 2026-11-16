import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, UserRound, UsersRound } from "lucide-react";
import { useAuth } from "../../features/auth/use-auth";
import { Button } from "../ui/button";
import { RoleBadge } from "../ui/badge";
import { cn, initials } from "../../lib/utils";

export function AppLayout() {
  const { me, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" strokeLinecap="round" />
                <path d="M7 7h4M9 13v8" strokeLinecap="round" />
                <path d="M17 3c-1.6 1.2-2.4 3-2.4 5.4 0 1.6.8 2.6 2.4 2.6s2.4-1 2.4-2.6C19.4 6 18.6 4.2 17 3Z" />
                <path d="M17 11v10" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight">DineOut</span>
          </Link>

          <div className="flex items-center gap-1.5">
            {me ? (
              <div className="mr-1 hidden items-center gap-2 sm:flex">
                <span className="max-w-40 truncate text-[13px] text-muted-foreground">
                  {me.user.displayName}
                </span>
                {role ? <RoleBadge role={role} /> : null}
              </div>
            ) : null}
            <Link to="/profile" aria-label="Profil">
              <Button variant="ghost" size="icon">
                {me ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-foreground">
                    {initials(me.user.displayName)}
                  </span>
                ) : (
                  <UserRound className="h-4 w-4" />
                )}
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Keluar">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-24 pt-5 sm:pb-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2">
          <BottomLink to="/" icon={<UsersRound className="h-4 w-4" />} label="Grup" />
          <BottomLink to="/profile" icon={<UserRound className="h-4 w-4" />} label="Profil" />
        </div>
      </nav>
    </div>
  );
}

function BottomLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center gap-1 py-2.5 text-2xs font-medium",
          isActive ? "text-primary" : "text-muted-foreground",
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
