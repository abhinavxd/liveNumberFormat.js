const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testMatch: "livenumberformat.test.cjs",
    fullyParallel: true,
    workers: 4,
    use: { baseURL: "http://127.0.0.1:4173", headless: true },
    projects: [
        { name: "chromium", use: { browserName: "chromium" } },
        { name: "firefox", use: { browserName: "firefox" } },
        { name: "webkit", use: { browserName: "webkit" } },
    ],
    webServer: { command: "node test-server.cjs", url: "http://127.0.0.1:4173" },
});
