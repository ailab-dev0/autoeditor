import { NextRequest } from "next/server";
import { proxyJsonResponse } from "@/lib/backend-proxy";

// GET /api/projects - list all projects
export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search; // includes leading "?"
  return proxyJsonResponse(`/api/projects${qs}`);
}

// POST /api/projects - create a new project
export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxyJsonResponse("/api/projects", {
    method: "POST",
    body,
  });
}
