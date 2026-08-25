import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import process from "node:process";

const output = resolve(
  process.argv[2] ?? ".migration-build/migrate-production.mjs",
);
await mkdir(dirname(output), { recursive: true });
await build({
  entryPoints: [resolve("scripts/migrate-production.mjs")],
  outfile: output,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "bundle",
  sourcemap: false,
  logLevel: "info",
});
