"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, LayoutDashboard, Database, Menu, X, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface HeaderProps {
  className?: string;
}

const NAV_LINKS = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/repository", icon: Database, label: "Repository" },
  { href: "/settings", icon: Settings, label: "Settings" },
] as const;

function formatRole(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function Header({ className }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <header
      className={cn(
        "relative border-b border-border bg-background",
        className,
      )}
    >
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              EL
            </div>
            <span className="font-semibold text-sm">EditorLens MK-12</span>
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, icon: Icon, label }) => (
            <Button key={href} asChild variant="ghost" size="sm">
              <Link href={href}>
                <Icon className="size-4" />
                {label}
              </Link>
            </Button>
          ))}

          {/* Auth section */}
          <div className="ml-2 pl-2 border-l border-border flex items-center gap-2">
            {user ? (
              <>
                <span className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{user.name}</span>
                  {" "}
                  <span className="text-muted-foreground-dim">({formatRole(user.role)})</span>
                </span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="size-4" />
                  Sign Out
                </Button>
              </>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">
                  <LogIn className="size-4" />
                  Sign In
                </Link>
              </Button>
            )}
          </div>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex items-center justify-center size-9 rounded-md text-foreground hover:bg-accent transition-colors"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <nav className="sm:hidden border-t border-border bg-background px-4 py-2 space-y-1">
          {NAV_LINKS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </Link>
          ))}

          {/* Mobile auth section */}
          <div className="border-t border-border pt-2 mt-2">
            {user ? (
              <>
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">{user.name}</span>
                  {" "}
                  <span className="text-muted-foreground-dim">({formatRole(user.role)})</span>
                </div>
                <button
                  onClick={() => { setMobileMenuOpen(false); logout(); }}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors w-full"
                >
                  <LogOut className="size-4 text-muted-foreground" />
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                <LogIn className="size-4 text-muted-foreground" />
                Sign In
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
