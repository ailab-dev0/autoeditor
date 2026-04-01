import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

// GET /api/projects/:id/pipeline/stream - SSE proxy to backend
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const backendRes = await proxyToBackend(
    `/api/projects/${id}/pipeline/stream`,
    {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
      },
    },
  );

  if (!backendRes.ok || !backendRes.body) {
    return new Response(
      JSON.stringify({ error: "Failed to connect to backend SSE stream" }),
      { status: backendRes.status, headers: { "Content-Type": "application/json" } },
    );
  }

  // Pipe the backend SSE stream directly through to the client.
  // Use a TransformStream to handle client disconnect cleanup.
  const { readable, writable } = new TransformStream();

  const writer = writable.getWriter();
  const reader = backendRes.body.getReader();

  // Forward data from backend to client
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch {
      // Client disconnected or backend closed
    } finally {
      try { writer.close(); } catch { /* already closed */ }
      try { reader.cancel(); } catch { /* already cancelled */ }
    }
  })();

  // Clean up if client disconnects
  request.signal.addEventListener("abort", () => {
    try { reader.cancel(); } catch { /* ignore */ }
    try { writer.close(); } catch { /* ignore */ }
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
