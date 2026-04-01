import { NextRequest } from "next/server";
import { proxyJsonResponse } from "@/lib/backend-proxy";

// GET /api/projects/:id/marks
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyJsonResponse(`/api/projects/${id}/marks`);
}

// PUT /api/projects/:id/marks
// Dashboard api-client sends { markId, ...data } to this route.
// Backend expects PUT /api/projects/:id/marks/:segId with the mark data.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { markId, ...markData } = body;

  return proxyJsonResponse(`/api/projects/${id}/marks/${markId}`, {
    method: "PUT",
    body: JSON.stringify(markData),
  });
}
