import { NextRequest } from "next/server";
import { proxyJsonResponse } from "@/lib/backend-proxy";

// GET /api/projects/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyJsonResponse(`/api/projects/${id}`);
}

// PUT /api/projects/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.text();
  return proxyJsonResponse(`/api/projects/${id}`, {
    method: "PUT",
    body,
  });
}

// DELETE /api/projects/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyJsonResponse(`/api/projects/${id}`, {
    method: "DELETE",
  });
}
