import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";

const port = Number.parseInt(process.env.PORT ?? "8080", 10);
const host = "0.0.0.0";
const root = resolve("dist");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"]
]);

function resolveAssetPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const candidate = resolve(join(root, normalizedPath));

  if (!candidate.startsWith(root)) {
    return join(root, "index.html");
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  return join(root, "index.html");
}

const server = createServer((request, response) => {
  const assetPath = resolveAssetPath(request.url ?? "/");
  const contentType = contentTypes.get(extname(assetPath)) ?? "application/octet-stream";

  response.writeHead(200, {
    "content-type": contentType,
    "cache-control": assetPath.endsWith("index.html")
      ? "no-store"
      : "public, max-age=31536000, immutable"
  });

  createReadStream(assetPath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`frontend listening on http://${host}:${port}`);
});

