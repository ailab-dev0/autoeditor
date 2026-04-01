import { NextRequest } from "next/server";
import { proxyToBackend, proxyJsonResponse } from "@/lib/backend-proxy";

// POST /api/projects/:id/export - generate export
// Backend: GET /api/projects/:id/export?format=...
// The backend uses GET for export generation/download, so we map POST -> GET.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { format } = body;

  // Map dashboard export format names to backend format names
  const backendFormat =
    format === "edit_package_v3"
      ? "json"
      : format === "premiere_xml"
        ? "premiere_xml"
        : format ?? "json";

  const backendRes = await proxyToBackend(
    `/api/projects/${id}/export?format=${backendFormat}`,
  );

  // Return as JSON with metadata for the dashboard
  if (!backendRes.ok) {
    const error = await backendRes.json().catch(() => ({ error: "Export failed" }));
    return Response.json(error, { status: backendRes.status });
  }

  return Response.json({
    id: crypto.randomUUID(),
    projectId: id,
    format,
    status: "completed",
    createdAt: new Date().toISOString(),
  });
}

// GET /api/projects/:id/export - download export
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") ?? "json";

  const backendRes = await proxyToBackend(
    `/api/projects/${id}/export?format=${format}`,
  );

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: {
      "Content-Type": backendRes.headers.get("content-type") ?? "application/octet-stream",
      ...(backendRes.headers.get("content-disposition")
        ? { "Content-Disposition": backendRes.headers.get("content-disposition")! }
        : {}),
    },
  });
}
