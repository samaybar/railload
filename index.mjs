import http from "http";
import httpProxy from "http-proxy";

const PORT = process.env.PORT || 8080;

// Example: "http://service-a.railway.internal:8080,http://service-b.railway.internal:8080"
const targetsEnv = process.env.TARGETS;
if (!targetsEnv) {
  throw new Error("TARGETS env var is required, e.g. http://a:8080,http://b:8080");
}

const targets = targetsEnv.split(",").map(t => t.trim()).filter(Boolean);

if (targets.length === 0) {
  throw new Error("TARGETS env var must contain at least one URL");
}

console.log("Internal LB targets:");
targets.forEach(t => console.log(" -", t));

const proxy = httpProxy.createProxyServer({});
let currentIndex = 0;

// Round-robin selector
function getNextTarget() {
  const target = targets[currentIndex];
  currentIndex = (currentIndex + 1) % targets.length;
  return target;
}

const server = http.createServer((req, res) => {
  const target = getNextTarget();
  console.log(`→ ${req.method} ${req.url} -> ${target}`);

  proxy.web(req, res, { target }, err => {
    console.error("Proxy error:", err?.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
    }
    res.end("Bad gateway (internal LB error)");
  });
});

// Handle WebSocket upgrade if needed
server.on("upgrade", (req, socket, head) => {
  const target = getNextTarget();
  proxy.ws(req, socket, head, { target }, err => {
    console.error("WS proxy error:", err?.message);
    socket.destroy();
  });
});

server.listen(PORT, "::", () => {
  console.log(`Internal load balancer listening on port ${PORT}`);
});
