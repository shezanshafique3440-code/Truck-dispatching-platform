// Local-only HTTPS helper for integration checks. Never deploy this test proxy.
import https from "node:https";
import http from "node:http";
import { readFileSync } from "node:fs";
if (!process.env.LOCAL_TLS_KEY || !process.env.LOCAL_TLS_CERT) throw new Error("Supply LOCAL_TLS_KEY and LOCAL_TLS_CERT paths.");
const upstreamPort = Number(process.env.LOCAL_UPSTREAM_PORT ?? 3001);
const port = Number(process.env.LOCAL_TLS_PORT ?? 3443);
https.createServer({ key: readFileSync(process.env.LOCAL_TLS_KEY), cert: readFileSync(process.env.LOCAL_TLS_CERT) }, (request, response) => {
  const upstream = http.request({ hostname: "127.0.0.1", port: upstreamPort, method: request.method, path: request.url, headers: { ...request.headers, "x-real-ip": request.socket.remoteAddress ?? "127.0.0.1", "x-forwarded-proto": "https" } }, result => { response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response); });
  upstream.on("error", () => { response.writeHead(502); response.end("Local upstream unavailable."); });
  request.pipe(upstream);
}).listen(port, "127.0.0.1", () => console.log("Local test HTTPS proxy started."));
