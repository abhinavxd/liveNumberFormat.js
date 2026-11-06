const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const { resolve, extname, sep } = require("node:path");

const root = __dirname;
const contentTypes = { ".html": "text/html", ".js": "text/javascript" };

createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const path = resolve(root, "." + (pathname === "/" ? "/docs/index.html" : pathname));
    if (!path.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
    }
    try {
        const body = await readFile(path);
        response.writeHead(200, {
            "Content-Type": contentTypes[extname(path)] ?? "text/plain",
            "Cache-Control": "no-store",
        });
        response.end(body);
    } catch {
        response.writeHead(404).end();
    }
}).listen(4173, "127.0.0.1");
