import { NextRequest } from "next/server";

/* -------------------------------------------------------------------- */
/* generic proxy helper                                                 */
/* -------------------------------------------------------------------- */
async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const BASE_URL = process.env.BYTEBOT_AGENT_BASE_URL!;
  const subPath = path.length ? `/${path.join("/")}` : "";
  const url = `${BASE_URL}${subPath}${req.nextUrl.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: { "Content-Type": "application/json" },
    body:
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : await req.text(),
  };

  const res = await fetch(url, init);
  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

/* -------------------------------------------------------------------- */
/* route handlers                                                       */
/* -------------------------------------------------------------------- */
type PathParams = Promise<{ path?: string[] }>; // <- Promise is the key

async function handler(req: NextRequest, { params }: { params: PathParams }) {
  const { path } = await params;
  return proxy(req, path ?? []);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
