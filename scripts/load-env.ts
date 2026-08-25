import { createRequire } from "node:module";

const { loadEnvConfig } = createRequire(import.meta.url)("@next/env") as typeof import("@next/env");
loadEnvConfig(process.cwd());
