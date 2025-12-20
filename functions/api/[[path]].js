export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  // Preflight CORS
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  // Reenviar solo a este origen (evita open-proxy)
  const targetBase = "https://www.vitoria-gasteiz.org";

  // url.pathname será /api/lo-que-sea -> lo convertimos a /lo-que-sea
  const targetPath = url.pathname.replace(/^\/api/, "");
  const targetUrl = new URL(targetBase + targetPath);
  targetUrl.search = url.search;

  // Solo GET (tu app usa GET)
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders(request) });
  }

  const upstream = await fetch(targetUrl.toString(), {
    method: "GET",
    headers: {
      "Accept": "*/*",
      "User-Agent": "gasteiz-lines-pages-proxy"
    },
    // Cache edge corto (opcional)
    cf: { cacheTtl: 15, cacheEverything: true },
  });

  const headers = new Headers(upstream.headers);
  const extra = corsHeaders(request);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);

  return new Response(upstream.body, { status: upstream.status, headers });
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
