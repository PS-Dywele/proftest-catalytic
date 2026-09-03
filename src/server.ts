import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function withDeploymentHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type")?.toLowerCase() ?? "";

  headers.set("x-content-type-options", "nosniff");
  if (contentType.includes("text/html")) {
    headers.set("cache-control", "no-store, max-age=0, must-revalidate");
    headers.set("pragma", "no-cache");
    headers.set("expires", "0");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const COMPRESSIBLE = [
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/json",
  "image/svg+xml",
];

// Large uncompressed JS bundles are a common stall point behind inspecting
// proxies (Cisco Secure Access / ZTA), which buffer the whole body before
// releasing it. Nitro's static handler serves identity bytes, so gzip here.
function withCompression(request: Request, response: Response): Response {
  if (!response.body || request.method === "HEAD") return response;
  if (response.status < 200 || response.status === 204 || response.status === 304) return response;
  if (response.headers.get("content-encoding")) return response;

  const accepts = request.headers.get("accept-encoding")?.toLowerCase() ?? "";
  if (!accepts.includes("gzip")) return response;
  if (typeof CompressionStream === "undefined") return response;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!COMPRESSIBLE.some((type) => contentType.includes(type))) return response;

  const headers = new Headers(response.headers);
  headers.set("content-encoding", "gzip");
  headers.delete("content-length");
  headers.append("vary", "accept-encoding");

  return new Response(response.body.pipeThrough(new CompressionStream("gzip")), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withCompression(
        request,
        withDeploymentHeaders(await normalizeCatastrophicSsrResponse(response)),
      );
    } catch (error) {
      console.error(error);
      return withDeploymentHeaders(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },
};

