// Copies pdf.js runtime assets (worker, wasm decoders, fonts, cmaps, colour profiles) into
// public/pdfjs/<version>/ so the viewer loads them from our origin. The version in the path
// keeps the worker in lockstep with the library and lets browsers cache it forever.
// Runs before `dev` and `build`; the output is gitignored.
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve("pdfjs-dist/package.json"));
const { version } = require("pdfjs-dist/package.json");
const outRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pdfjs");
const out = join(outRoot, version);

const exists = (p) =>
  stat(p).then(
    () => true,
    () => false,
  );
if (await exists(join(out, "pdf.worker.min.mjs"))) process.exit(0);

// Drop assets of other pdf.js versions.
if (await exists(outRoot)) {
  for (const entry of await readdir(outRoot)) {
    if (entry !== version) await rm(join(outRoot, entry), { recursive: true, force: true });
  }
}
await mkdir(out, { recursive: true });
await cp(join(pkgDir, "build", "pdf.worker.min.mjs"), join(out, "pdf.worker.min.mjs"));
for (const dir of ["wasm", "standard_fonts", "cmaps", "iccs"]) {
  await cp(join(pkgDir, dir), join(out, dir), { recursive: true });
}
console.log(`pdf.js ${version} assets -> public/pdfjs/${version}`);
