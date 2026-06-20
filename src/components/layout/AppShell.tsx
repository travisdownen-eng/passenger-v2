import { Link, useRouterState } from "@tanstack/react-router";
import { ListChecks, Users, RefreshCw, Settings as SettingsIcon, Moon, Sun, Download, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSync, formatSyncTimestamp } from "@/lib/sync";

type NavItem = { to: string; label: string; icon: typeof Users };

const navItems: NavItem[] = [
  { to: "/", label: "Today's Work", icon: ListChecks },
  { to: "/patients", label: "Patients", icon: Users },
  { to: "/sync", label: "Sync", icon: RefreshCw },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [dark, setDark] = useState(false);
  const sync = useSync();

  useEffect(() => {
    const stored = localStorage.getItem("passenger-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("passenger-theme", next ? "dark" : "light");
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <header className="border-b border-border bg-card/80 backdrop-blur z-30 shrink-0">
        <div className="max-w-[1400px] w-full mx-auto px-4 lg:px-6 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-semibold shadow-soft">
              P
            </div>
            <div className="leading-tight">
              <div className="font-display font-semibold text-[15px]">Passenger</div>
              <div className="text-[10px] text-muted-foreground -mt-0.5 uppercase tracking-wide">
                Clinician copilot
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5"
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </div>
        </div>
        <SyncBar
          lastSyncAt={sync.lastSyncAt}
          newVisits={sync.newVisits}
          pendingUploads={sync.pendingUploads}
          syncing={sync.syncing}
          onSync={sync.syncNow}
        />
      </header>
      <main className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">{children}</main>
    </div>
  );
}

function SyncBar({
  lastSyncAt,
  newVisits,
  pendingUploads,
  syncing,
  onSync,
}: {
  lastSyncAt: Date;
  newVisits: number;
  pendingUploads: number;
  syncing: boolean;
  onSync: () => void;
}) {
  return (
    <div className="border-t border-border bg-muted/30">
      <div className="max-w-[1400px] w-full mx-auto px-4 lg:px-6 py-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <RefreshCw className="size-3.5" />
          <span className="font-medium">Last sync:</span>
          <span className="font-mono">{formatSyncTimestamp(lastSyncAt)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Download className="size-3.5 text-info" />
          <span className="text-muted-foreground">New visits:</span>
          <span className={cn("font-semibold", newVisits > 0 ? "text-info" : "text-muted-foreground")}>
            {newVisits}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Upload className="size-3.5 text-warning-foreground" />
          <span className="text-muted-foreground">Pending upload:</span>
          <span
            className={cn(
              "font-semibold",
              pendingUploads > 0 ? "text-warning-foreground" : "text-muted-foreground",
            )}
          >
            {pendingUploads}
          </span>
        </div>
        <button
          onClick={onSync}
          disabled={syncing}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors",
            "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
          )}
        >
          <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>
    </div>
  );
}
