import { cp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const output = resolve(process.argv[2] ?? "dist");
const version = process.env.APP_VERSION ?? "2.1.0";
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("APP_VERSION must have three numeric parts.");

await cp("public", output, { recursive: true });
for (const name of ["index.html", "replay.html", "sw.js"]) {
  const path = join(output, name);
  const source = await readFile(path, "utf8");
  await writeFile(path, source.replaceAll("__APP_VERSION__", version));
}

// Keep both entry paths installable. A redirect outside /v2/ would leave the
// scope of previously installed preview apps, and might strand their history.
const alias = join(output, "v2");
const shared = [
  "assets", "scripts", "styles.css", "replay.css", "night.css",
  "manifest.webmanifest", "manifest-dark.webmanifest", "replay.html", "sw.js"
];
await Promise.all(shared.map((name) => cp(join(output, name), join(alias, name), { recursive: true })));
const gamePage = await readFile(join(output, "index.html"), "utf8");
await writeFile(join(alias, "index.html"), gamePage.replace('rel="canonical" href="./"', 'rel="canonical" href="../"'));
