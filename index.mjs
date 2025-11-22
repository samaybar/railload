import http from "http";
import { request as httpRequest } from "http";

const PORT = process.env.PORT || 8080;

const rawTargets = process.env.TARGETS || "";
const targets = rawTargets
  .split(",")
  .map(t => t.trim())
  .filter(Boolean);

if (!targets.length) {
  throw new Error("TARGETS env var is required");
}

console.log("LB targets:", targets);

let i = 0;
function pickTarget() {
  const t = targets[i];
  i = (i + 1) % targets.length;
  return t;
}

const server = http.createServer((clientReq, clientRes) => {
  const target = pickTarget();
  console.log(`→ ${clientReq.method} ${clientReq.url} -> ${target}`);

  const url = new URL(clientReq.url, target);

  const options = {
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    method: clientReq.method,
    headers: clientReq.headers
  };

  const proxyReq = httpRequest(options, proxyRes => {
    clientRes.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(clientRes);
  });

  proxyReq.on("error", err => {
    console.error("Proxy error:", err.code, err.message);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { "Content-Type": "text/plain" });
    }
    clientRes.end("Bad gateway (internal LB error)");
  });

  clientReq.pipe(proxyReq);
});

server.listen(PORT, "::", () => {
  console.log(`Internal LB running on port ${PORT}`);
});
