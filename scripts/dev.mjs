// Runs the API (:4000) and the Vite dev server (:5173) together. Ctrl+C stops both.
import { spawn } from "node:child_process";

const procs = [
  ["api", ["--prefix", "server", "run", "dev"]],
  ["web", ["--prefix", "client", "run", "dev"]],
].map(([name, args]) => {
  const child = spawn("npm", args, { stdio: "inherit", shell: process.platform === "win32" });
  child.on("exit", (code) => { if (code) console.error(`[${name}] exited with code ${code}`); stopAll(); });
  return child;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const p of procs) p.kill("SIGTERM");
  setTimeout(() => process.exit(0), 300);
}
process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
