import { NextRequest } from "next/server";
import { proxyJsonResponse, proxyToBackend } from "@/lib/backend-proxy";

// GET /api/projects/:id/transcript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const exportFormat = searchParams.get("export");

  // Export requests return file data, not JSON
  if (exportFormat) {
    // Backend uses /api/projects/:id/transcript/export?format=...
    const format =
      exportFormat === "srt" ? "srt" : exportFormat === "txt" ? "text" : "json";
    const videoPath = searchParams.get("video_path") ?? "";
    const qs = videoPath
      ? `?format=${format}&video_path=${encodeURIComponent(videoPath)}`
      : `?format=${format}`;

    const backendRes = await proxyToBackend(
      `/api/projects/${id}/transcript/export${qs}`,
    );

    return new Response(backendRes.body, {
      status: backendRes.status,
      headers: {
        "Content-Type": backendRes.headers.get("content-type") ?? "text/plain",
        ...(backendRes.headers.get("content-disposition")
          ? { "Content-Disposition": backendRes.headers.get("content-disposition")! }
          : {}),
      },
    });
  }

  // Standard transcript fetch
  const qs = request.nextUrl.search;
  return proxyJsonResponse(`/api/projects/${id}/transcript${qs}`);
}
