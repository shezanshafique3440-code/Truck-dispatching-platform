import { defineConfig } from "@playwright/test";
const baseURL = process.env.SMOKE_BASE_URL ?? "https://localhost:3443";
if (!/^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseURL)) throw new Error("Browser fixtures require a loopback HTTPS test origin.");
export default defineConfig({ testDir: "./tests", fullyParallel: false, workers: 1, retries: 0, timeout: 240000, outputDir: process.env.REVIEW_OUTPUT_DIR ?? "/tmp/northlane-browser-results", reporter: "line", use: { baseURL, ignoreHTTPSErrors: true, trace: "off", screenshot: "off", video: "off", launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium", args: ["--no-sandbox"] } } });
