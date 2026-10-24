export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Redirección canónica a /flota-x500/
    if (url.pathname === "/flota-x500") {
      return Response.redirect(`${url.origin}/flota-x500/`, 301);
    }

    // Redirección canónica a /trading/
    if (url.pathname === "/trading") {
      return Response.redirect(`${url.origin}/trading/`, 301);
    }

    // Endpoint directo sin caché de telemetría de trading
    if (url.pathname === "/api/trading/telemetry" || url.pathname === "/trading/telemetry.json") {
      const telemReq = new Request(new URL("/telemetry/trading-telemetry.json", request.url), request);
      const res = await env.ASSETS.fetch(telemReq);
      const headers = new Headers(res.headers);
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      headers.set("Access-Control-Allow-Origin", "*");
      return new Response(res.body, { status: res.status, headers });
    }

    // Endpoint directo sin caché de telemetría de flota
    if (url.pathname === "/api/flota-x500/telemetry" || url.pathname === "/flota-x500/telemetry.json") {
      const telemReq = new Request(new URL("/telemetry/fleet-telemetry.json", request.url), request);
      const res = await env.ASSETS.fetch(telemReq);
      const headers = new Headers(res.headers);
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      headers.set("Access-Control-Allow-Origin", "*");
      return new Response(res.body, { status: res.status, headers });
    }

    // Endpoint directo sin caché de última ejecución
    if (url.pathname === "/api/flota-x500/last-run" || url.pathname === "/flota-x500/last-run.json") {
      const runReq = new Request(new URL("/last-run-report.json", request.url), request);
      const res = await env.ASSETS.fetch(runReq);
      const headers = new Headers(res.headers);
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      headers.set("Access-Control-Allow-Origin", "*");
      return new Response(res.body, { status: res.status, headers });
    }

    const response = await env.ASSETS.fetch(request);

    // Eliminar caché para telemetría y datos JSON dinámicos
    if (url.pathname.endsWith(".json") || url.pathname.includes("/telemetry/")) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
      headers.set("Access-Control-Allow-Origin", "*");
      return new Response(response.body, { status: response.status, headers });
    }

    return response;
  }
};
