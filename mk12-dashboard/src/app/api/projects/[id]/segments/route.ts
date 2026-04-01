import { NextRequest } from "next/server";
import { proxyJsonResponse } from "@/lib/backend-proxy";

// GET /api/projects/:id/segments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const qs = request.nextUrl.search;
  return proxyJsonResponse(`/api/projects/${id}/segments${qs}`);
}

// PUT /api/projects/:id/segments - approve/reject/bulk actions
// The dashboard api-client sends { segmentId, action: "approve"|"reject"|"bulk_approve", ... }
// The backend expects separate endpoints:
//   PUT /api/projects/:id/segments/:segId/approve
//   PUT /api/projects/:id/segments/:segId/reject
//   PUT /api/projects/:id/segments/bulk
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { action, segmentId, segmentIds, override } = body;

  switch (action) {
    case "approve": {
      return proxyJsonResponse(
        `/api/projects/${id}/segments/${segmentId}/approve`,
        { method: "PUT" },
      );
    }

    case "reject": {
      return proxyJsonResponse(
        `/api/projects/${id}/segments/${segmentId}/reject`,
        {
          method: "PUT",
          body: JSON.stringify({
            override_decision: override?.decision,
            reason: override?.reason,
          }),
        },
      );
    }

    case "bulk_approve": {
      return proxyJsonResponse(
        `/api/projects/${id}/segments/bulk`,
        {
          method: "PUT",
          body: JSON.stringify({
            segment_ids: segmentIds,
            approved: true,
          }),
        },
      );
    }

    default:
      return Response.json(
        { error: "Invalid action", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
  }
}
