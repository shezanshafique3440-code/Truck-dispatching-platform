import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { runtimeProblems } from "./check-runtime.mjs";
const errors = runtimeProblems();
let built;
try { built = readFileSync(new URL("../build-public-origin.txt", import.meta.url), "utf8").trim(); } catch { errors.push("The image's public-origin build marker is missing."); }
try { if (!built || new URL(built).origin !== new URL(process.env.PUBLIC_SITE_URL).origin) errors.push("PUBLIC_SITE_URL differs from the image build. Rebuild for the approved public origin."); } catch { errors.push("Rebuild with a valid public HTTPS origin."); }
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
const child = spawn(process.execPath, ["server.js"], { stdio: "inherit" });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { console.error("Could not start the application server."); process.exit(1); });
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
