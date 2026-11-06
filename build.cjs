const { readFileSync, writeFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { minify } = require("terser");

async function build() {
    const source = readFileSync("livenumberformat.js", "utf8");
    const { code } = await minify(source, { module: true });
    writeFileSync("docs/livenumberformat.min.js", code + "\n");
    const hash = createHash("sha256").update(code).digest("hex").slice(0, 12);
    const html = readFileSync("docs/index.html", "utf8");
    writeFileSync("docs/index.html", html.replace(/\.\/livenumberformat\.min\.js(?:\?build=[a-f0-9]+)?/,
        `./livenumberformat.min.js?build=${hash}`));
}

build().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
