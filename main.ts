const MAIN_HOST = "208.123.185.235.sslip.io";
const PORTS = [2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014];

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  if (url.pathname === "/health" || url.pathname === "/api/v1/ping") {
    return new Response(JSON.stringify({ ok: true, ts: Date.now() }), { headers: { "Content-Type": "application/json" } });
  }
  if (req.headers.get("upgrade") === "websocket") {
    const { socket: clientWs, response } = Deno.upgradeWebSocket(req);
    
    // Extract port from path: /p2001/vless-ws -> 2001, /vless-ws -> random
    const m = url.pathname.match(/^\/p(\d+)\/vless-ws$/);
    const port = m ? parseInt(m[1]) : PORTS[Math.floor(Math.random() * PORTS.length)];
    
    const buffer: any[] = [];
    let upstreamReady = false;

    clientWs.onopen = () => {
      const upstream = new WebSocket(`wss://${MAIN_HOST}:8443/p${port}/vless-ws`);
      upstream.binaryType = "arraybuffer";
      clientWs.onmessage = (e) => {
        if (upstreamReady) upstream.send(e.data);
        else buffer.push(e.data);
      };
      upstream.onopen = () => {
        upstreamReady = true;
        for (const msg of buffer) upstream.send(msg);
        buffer.length = 0;
        upstream.onmessage = (e) => { if (clientWs.readyState === 1) clientWs.send(e.data); };
      };
      clientWs.onclose = () => upstream.close();
      upstream.onclose = () => clientWs.close();
      upstream.onerror = () => clientWs.close();
      clientWs.onerror = () => upstream.close();
    };
    return response;
  }
  return new Response("OK");
});
