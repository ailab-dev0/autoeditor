"use client";

/**
 * PresenceBar — shows connected users as colored avatar circles.
 *
 * Displays in the project layout breadcrumb area. Each user gets
 * a unique color (assigned by the collab server), with tooltips
 * for name and role. Active users have a pulsing indicator.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CollabUser } from "@/hooks/use-collaboration";

interface PresenceBarProps {
  users: CollabUser[];
  myClientId: string | null;
  isConnected: boolean;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function isActive(user: CollabUser): boolean {
  // Consider a user active if last seen within 15 seconds
  return Date.now() - user.lastSeen < 15_000;
}

function UserAvatar({
  user,
  isMe,
}: {
  user: CollabUser;
  isMe: boolean;
}) {
  const active = isActive(user);
  const roleLabel = user.role === "admin"
    ? "Admin"
    : user.role === "editor"
      ? "Editor"
      : user.role === "reviewer"
        ? "Reviewer"
        : "Viewer";

  return (
    <div className="group relative" title={`${user.name} (${roleLabel})`}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full text-[10px] font-bold transition-all",
          "size-7 ring-2 ring-background",
          isMe && "ring-primary/50",
        )}
        style={{ backgroundColor: user.color, color: "#fff" }}
      >
        {getInitials(user.name)}

        {/* Active pulse indicator */}
        {active && (
          <span
            className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background"
            style={{ backgroundColor: "#2ECC71" }}
          >
            <span className="absolute inset-0 animate-ping rounded-full opacity-75" style={{ backgroundColor: "#2ECC71" }} />
          </span>
        )}
      </div>

      {/* Tooltip */}
      <div className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 rounded-md bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-border">
        <span className="font-medium">{user.name}</span>
        <span className="text-muted-foreground ml-1">({roleLabel})</span>
        {isMe && <span className="text-primary ml-1">(you)</span>}
        {user.cursor.segmentId && (
          <div className="text-muted-foreground text-[9px] mt-0.5">
            Viewing segment {user.cursor.segmentId.slice(0, 8)}...
          </div>
        )}
      </div>
    </div>
  );
}

export function PresenceBar({ users, myClientId, isConnected, className }: PresenceBarProps) {
  const otherUsers = useMemo(
    () => users.filter((u) => u.clientId !== myClientId),
    [users, myClientId],
  );

  const me = useMemo(
    () => users.find((u) => u.clientId === myClientId),
    [users, myClientId],
  );

  // Show max 8, then +N
  const displayUsers = otherUsers.slice(0, 8);
  const overflowCount = Math.max(0, otherUsers.length - 8);

  if (users.length === 0 && !isConnected) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* Connection indicator */}
      <div
        className={cn(
          "size-2 rounded-full transition-colors",
          isConnected ? "bg-green-400" : "bg-yellow-500",
        )}
        title={isConnected ? "Connected" : "Reconnecting..."}
      />

      {/* My avatar */}
      {me && <UserAvatar user={me} isMe />}

      {/* Separator if there are other users */}
      {me && otherUsers.length > 0 && (
        <div className="mx-0.5 h-4 w-px bg-border" />
      )}

      {/* Other users */}
      <div className="flex items-center -space-x-1.5">
        {displayUsers.map((user) => (
          <UserAvatar key={user.clientId} user={user} isMe={false} />
        ))}

        {overflowCount > 0 && (
          <div className="flex items-center justify-center size-7 rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-2 ring-background">
            +{overflowCount}
          </div>
        )}
      </div>

      {/* User count label */}
      <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">
        {users.length} online
      </span>
    </div>
  );
}
