/**
 * Backend proxy utility for Next.js API routes.
 *
 * Forwards requests from the dashboard's API routes to the
 * MK-12 backend server, enabling the dashboard to act as a
 * pass-through proxy rather than serving mock data.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

/**
 * Proxy a request to the backend server.
 *
 * @param path  The backend API path (e.g. "/api/projects")
 * @param init  Optional RequestInit to forward (method, body, headers, etc.)
 * @returns     The raw Response from the backend
 */
export async function proxyToBackend(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Forward any additional headers from the original request
  if (init?.headers) {
    const incoming =
      init.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : (init.headers as Record<string, string>);
    Object.assign(headers, incoming);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}

/**
 * Proxy a request and return the backend's JSON response
 * wrapped in a Next.js-compatible Response.
 */
export async function proxyJsonResponse(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const backendRes = await proxyToBackend(path, init);

  // For non-JSON responses (file downloads, etc.), pass through directly
  const contentType = backendRes.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Response(backendRes.body, {
      status: backendRes.status,
      headers: {
        "Content-Type": contentType,
        ...(backendRes.headers.get("content-disposition")
          ? { "Content-Disposition": backendRes.headers.get("content-disposition")! }
          : {}),
      },
    });
  }

  const data = await backendRes.json();
  return Response.json(data, { status: backendRes.status });
}
