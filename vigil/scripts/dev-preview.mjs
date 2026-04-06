/**
 * Start `next dev` with the boot PIN gate disabled (GM session for all APIs).
 * Same security model as documenting HEARTGARDEN_DEV_BOOT_NO_GATE=1 in `.env.local`:
 * only effective when NODE_ENV is development; never set this on Vercel.
 */
import { spawn } from "node:child_process";

const env = { ...process.env, HEARTGARDEN_DEV_BOOT_NO_GATE: "1" };
const child = spawn("npm", ["run", "dev"], { stdio: "inherit", env, shell: true });
child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
