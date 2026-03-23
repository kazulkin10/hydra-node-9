const MAIN_HOST = "208.123.185.235";
const VLESS_PORT = 2010;
const NODE_NAME = "deno9";

Deno.serve({ port: parseInt(Deno.env.get("PORT") || "8000") }, async (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/health" || url.pathname === "/api/v1/ping") {
    return new Response(JSON.stringify({ ok: true, node: NODE_NAME, port: VLESS_PORT, ts: Date.now() }), { headers: { "Content-Type": "application/json" } });
  }
  if (url.pathname.startsWith("/vless-ws")) {
    if (req.headers.get("upgrade") !== "websocket") return new Response("Need WebSocket", { status: 400 });
    const { socket: clientWs, response } = Deno.upgradeWebSocket(req);
    clientWs.onopen = () => {
      const upstream = new WebSocket(`ws://${MAIN_HOST}:${VLESS_PORT}/vless-ws`);
      upstream.binaryType = "arraybuffer";
      upstream.onopen = () => {
        clientWs.onmessage = (e) => { if (upstream.readyState === WebSocket.OPEN) upstream.send(e.data); };
        upstream.onmessage = (e) => { if (clientWs.readyState === WebSocket.OPEN) clientWs.send(e.data); };
      };
      upstream.onerror = () => clientWs.close();
      upstream.onclose = () => clientWs.close();
      clientWs.onerror = () => upstream.close();
      clientWs.onclose = () => upstream.close();
    };
    return response;
  }
  return new Response("OK");
});
