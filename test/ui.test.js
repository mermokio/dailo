import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("install promotion is completely removed", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/scripts/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(html, /install-banner|Keep Dailo close/);
  assert.doesNotMatch(app, /beforeinstallprompt|installPrompt/);
  assert.doesNotMatch(css, /\.install-banner/);
});

test("game viewport uses height-aware, scroll-free sizing", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /--app-height:\s*100dvh/);
  assert.match(css, /--tile-size:[\s\S]*?--app-height/);
  assert.match(css, /safe-area-inset-bottom/);
});

test("folded split layout is gated by posture and stacked segments", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/scripts/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8")
  ]);
  assert.match(app, /navigator\.devicePosture\?\.type === "folded"/);
  assert.match(app, /folded && hasVerticallyStackedSegments\(\)/);
  assert.match(html, /class="top-screen"[\s\S]*?class="bottom-screen"/);
  assert.match(css, /body\.folded-stacked-mode \.top-screen/);
  assert.match(css, /body\.folded-stacked-mode \.bottom-screen/);
});
