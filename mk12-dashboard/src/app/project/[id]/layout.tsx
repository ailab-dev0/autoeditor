"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { PresenceBar } from "@/components/shared/PresenceBar";
import { useProject } from "@/hooks/use-project";
import { usePresence } from "@/hooks/use-collaboration";
import { useWebSocket } from "@/hooks/use-websocket";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: project } = useProject(id);
  const { users, isConnected, myClientId, identify } = usePresence(id);

  // Own the WebSocket connection for this project — all child hooks
  // use useWebSocketSubscribe() to piggyback on this connection.
  const { connectionState } = useWebSocket(id);

  return (
    <div className="flex h-screen flex-col">
      <Header />

      {/* Breadcrumbs + Presence */}
      <div className="flex items-center justify-between border-b border-border-dim px-4 py-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Link href="/" className="hover:text-foreground transition-colors">
            Projects
          </Link>
          <ChevronRight className="size-3" />
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {project?.name ?? "Loading..."}
          </span>
        </div>

        <PresenceBar
          users={users}
          myClientId={myClientId}
          isConnected={isConnected}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ProjectSidebar
          projectId={id}
          projectName={project?.name}
          projectStatus={project?.status}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
