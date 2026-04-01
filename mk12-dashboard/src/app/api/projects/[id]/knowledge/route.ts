import { NextRequest } from "next/server";
import { proxyJsonResponse } from "@/lib/backend-proxy";

// GET /api/projects/:id/knowledge
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyJsonResponse(`/api/projects/${id}/knowledge`);
}
