import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

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

test("main and replay pages display the automatically generated deployment version", async () => {
  const [html, css, replayHtml, replayCss, workflow, serviceWorker] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../public/replay.html", import.meta.url), "utf8"),
    readFile(new URL("../public/replay.css", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  ]);
  assert.match(html, /class="app-version"[^>]*>v__APP_VERSION__/);
  assert.match(replayHtml, /class="replay-version"[^>]*>v__APP_VERSION__/);
  assert.doesNotMatch(html, /No account\. No ads\./);
  assert.match(css, /\.app-version\s*\{[\s\S]*?display:\s*block/);
  assert.match(replayCss, /\.replay-version\s*\{[\s\S]*?text-align:\s*center/);
  assert.match(workflow, /APP_VERSION:\s*1\.0\.\$\{\{ github\.run_number \}\}/);
  assert.match(workflow, /sed -i[\s\S]*public\/index\.html public\/replay\.html public\/sw\.js/);
  assert.match(serviceWorker, /dailo-v__APP_VERSION__/);
});

test("game viewport uses height-aware, scroll-free sizing", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /--app-height:\s*100dvh/);
  assert.match(css, /--tile-size:[\s\S]*?--app-height/);
  assert.match(css, /safe-area-inset-bottom/);
});

test("replay layout scales its board and spacing to short viewports", async () => {
  const css = await readFile(new URL("../public/replay.css", import.meta.url), "utf8");
  assert.match(css, /--replay-tile-size:\s*clamp\([^;]*dvh/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, var\(--replay-tile-size\)\)/);
  assert.match(css, /@media\s*\(max-height:\s*640px\)/);
  assert.match(css, /@media\s*\(max-height:\s*430px\)/);
  assert.match(css, /\.replay-content\s*\{\s*width:\s*min\(100%,\s*30rem\);\s*margin:\s*auto;/);
  assert.match(css, /\.replay-version\s*\{\s*margin:\s*0;/);
  assert.match(css, /\.replay-meta\s*\{[^}]*white-space:\s*pre-line/);
  assert.match(css, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*760px\)/);
  assert.match(css, /\.replay-content\s*\{\s*width:\s*min\(100%,\s*22rem\);\s*margin:\s*auto;/);
  assert.match(css, /\.replay-tile\s*\{[^}]*font-size:\s*clamp\([^;]*dvh/);
  assert.match(css, /\.replay-version\s*\{[\s\S]*?padding-top/);
});

test("top-bottom fold layout is gated by stacked viewport segments", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/scripts/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8")
  ]);
  assert.match(app, /matchMedia\("\(vertical-viewport-segments: 2\)"\)/);
  assert.match(app, /document\.body\.classList\.toggle\("folded-stacked-mode", stacked\)/);
  assert.doesNotMatch(app, /folded && stacked/);
  assert.match(app, /stackedSegmentsQuery\.addEventListener\?\.\("change", syncFoldLayout\)/);
  assert.match(html, /class="top-screen"[\s\S]*?class="bottom-screen"/);
  assert.match(css, /body\.folded-stacked-mode \.top-screen/);
  assert.match(css, /body\.folded-stacked-mode \.bottom-screen/);
});

test("fold diagnostics reports the Safari posture and segment signals", async () => {
  const diagnostic = await readFile(new URL("../public/fold-diagnostics.html", import.meta.url), "utf8");
  assert.match(diagnostic, /vertical-viewport-segments: 2/);
  assert.match(diagnostic, /navigator\.devicePosture/);
  assert.match(diagnostic, /window\.viewport\?\.segments/);
  assert.match(diagnostic, /stackedSegmentGeometry/);
});

test("share image sends only a file and emoji share links to a reveal replay", async () => {
  const [app, replayHtml, replayScript, serviceWorker] = await Promise.all([
    readFile(new URL("../public/scripts/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/replay.html", import.meta.url), "utf8"),
    readFile(new URL("../public/scripts/replay.js", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8")
  ]);
  assert.match(app, /navigator\.share\(\{ files: \[file\] \}\)/);
  assert.doesNotMatch(app, /navigator\.share\(\{ title: "My Dailo", text: shareText\(\), files:/);
  assert.match(app, /new URL\("\.\/replay\.html", window\.location\.href\)/);
  assert.match(app, /url\.searchParams\.set\("r", token\)/);
  assert.match(app, /\$\{replayLink\}/);
  assert.match(replayHtml, /id="reveal-button"[^>]*>Reveal guessed letters/);
  assert.match(replayHtml, /<script defer src="\.\/scripts\/replay\.js"><\/script>/);
  assert.match(replayScript, /search\.get\("r"\) \|\| fragment\.get\("r"\)/);
  assert.match(replayScript, /tile\.textContent = replay\.guesses\[row\]\[column\]\.toUpperCase\(\)/);
  assert.match(replayScript, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(replayScript, /^import\s/m);
  assert.match(serviceWorker, /"\.\/replay\.html"/);
  assert.match(serviceWorker, /"\.\/scripts\/replay\.js"/);
});

test("shared replay link paints colored guesses before reveal and reveals on tap", async () => {
  const source = await readFile(new URL("../public/scripts/replay.js", import.meta.url), "utf8");
  const token = "eyJ2IjoxLCJkIjoiMjAyNi0xMS0xNSIsImciOjAsImwiOlsiaGFycHMiLCJkdWNrcyIsImR1bmNlIl0sInIiOlsiMDAwMDAiLCIyMjEwMCIsIjIyMjIyIl19";
  class Element {
    constructor() {
      this.children = [];
      this.dataset = {};
      this.attributes = {};
      this.classes = new Set();
      this.classList = {
        add: (...names) => names.forEach((name) => this.classes.add(name)),
        remove: (...names) => names.forEach((name) => this.classes.delete(name)),
        contains: (name) => this.classes.has(name)
      };
      this.hidden = false;
      this.textContent = "";
    }
    append(child) { this.children.push(child); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.listeners ??= {}; this.listeners[name] = callback; }
    querySelectorAll(selector) {
      assert.equal(selector, ".replay-tile[data-row]");
      return this.children.flatMap((row) => row.children).filter((tile) => tile.dataset.row !== undefined);
    }
  }
  const elements = Object.fromEntries(["replay-root", "replay-board", "replay-meta", "replay-help", "reveal-button", "replay-error"].map((id) => [id, new Element()]));
  const scheduled = [];
  let clock = 0;
  vm.runInNewContext(source, {
    URLSearchParams,
    atob,
    Date,
    Intl,
    setTimeout: (callback, delay = 0) => scheduled.push({ callback, due: clock + delay }),
    window: { matchMedia: () => ({ matches: false }) },
    location: { search: "", hash: `#r=${token}` },
    document: {
      querySelector: (selector) => elements[selector.slice(1)],
      createElement: () => new Element()
    }
  });

  const board = elements["replay-board"];
  assert.match(elements["replay-meta"].textContent, /November 15, 2026\nGame 1 of 3 · 3\/6 guesses/);
  const tiles = board.children.flatMap((row) => row.children);
  assert.equal(board.children.length, 6);
  assert.equal(tiles.length, 30);
  assert.deepEqual([...tiles.slice(0, 5)].map((tile) => [...tile.classes][0]), Array(5).fill("absent"));
  assert.deepEqual([...tiles.slice(5, 10)].map((tile) => [...tile.classes][0]), ["correct", "correct", "present", "absent", "absent"]);
  assert.ok(tiles.every((tile) => tile.textContent === ""));

  elements["reveal-button"].listeners.click();
  assert.ok(tiles.every((tile) => tile.textContent === ""));
  assert.equal(elements["replay-board"].classList.contains("is-clearing"), true);
  const runNextTimer = () => {
    scheduled.sort((a, b) => a.due - b.due);
    const next = scheduled.shift();
    clock = next.due;
    next.callback();
  };
  runNextTimer(); // Clear the old color-only board.
  runNextTimer(); // Flip in the first letter of guess one.
  assert.equal(tiles[0].textContent, "H");
  assert.equal(tiles[5].textContent, "");
  while (scheduled.length) runNextTimer();
  assert.equal(tiles[5].textContent, "D");
  assert.equal(tiles[10].textContent, "D");
  assert.equal(elements["reveal-button"].disabled, true);
  assert.equal(elements["reveal-button"].textContent, "Letters revealed");
});

test("submit is hidden only when the selected game is finished", async () => {
  const app = await readFile(new URL("../public/scripts/app.js", import.meta.url), "utf8");
  assert.match(app, /els\.submitButton\.hidden = game\.status !== "playing"/);
  assert.match(app, /els\.shareButton\.hidden = game\.status === "playing"/);
});
