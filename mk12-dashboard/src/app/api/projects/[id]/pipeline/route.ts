import { NextRequest } from "next/server";
import { proxyJsonResponse } from "@/lib/backend-proxy";

// GET /api/projects/:id/pipeline - get pipeline status
// Backend route: GET /api/projects/:id/pipeline/status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyJsonResponse(`/api/projects/${id}/pipeline/status`);
}

// POST /api/projects/:id/pipeline - start pipeline
// Backend route: POST /api/projects/:id/pipeline/start
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyJsonResponse(`/api/projects/${id}/pipeline/start`, {
    method: "POST",
  });
}
