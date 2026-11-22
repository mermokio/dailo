import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
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
  assert.match(workflow, /APP_VERSION:\s*2\.1\.\$\{\{ github\.run_number \}\}/);
  assert.match(workflow, /run: npm run build/);
  assert.match(serviceWorker, /CACHE_NAME = `\$\{CACHE_PREFIX\}__APP_VERSION__`/);
});

test("the built site uses the same game and replay at the original and preview URLs", async (t) => {
  const output = await mkdtemp(join(tmpdir(), "dailo-build-test-"));
  t.after(() => rm(output, { recursive: true, force: true }));
  await promisify(execFile)(process.execPath, ["scripts/build-site.js", output], {
    env: { ...process.env, APP_VERSION: "2.1.123" }
  });

  const home = await readFile(join(output, "index.html"), "utf8");
  const alias = await readFile(join(output, "v2", "index.html"), "utf8");
  const replay = await readFile(join(output, "replay.html"), "utf8");
  assert.match(home, /v2\.1\.123/);
  assert.doesNotMatch(home, /__APP_VERSION__|· preview/);
  assert.equal(alias, home.replace('rel="canonical" href="./"', 'rel="canonical" href="../"'));
  assert.match(replay, /v2\.1\.123/);
  assert.equal(await readFile(join(output, "v2", "replay.html"), "utf8"), replay);
  for (const file of ["sw.js", "scripts/app.js", "scripts/state.js", "assets/install-icon-adaptive-180.png"]) {
    const [original, compatibility] = await Promise.all([
      readFile(join(output, file)), readFile(join(output, "v2", file))
    ]);
    assert.deepEqual(compatibility, original);
  }
});

test("game viewport uses height-aware, scroll-free sizing", async () => {
  const css = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(css, /--app-height:\s*100vh/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /height:\s*var\(--app-height\)/);
  assert.match(css, /container-type:\s*size/);
  assert.match(css, /safe-area-inset-bottom/);
});

test("replay layout scales its board and spacing to short viewports", async () => {
  const css = await readFile(new URL("../public/replay.css", import.meta.url), "utf8");
  assert.match(css, /height:\s*100dvh/);
  assert.match(css, /--tile-size:\s*min\(16vw,\s*9vh,\s*5rem\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(5,\s*var\(--tile-size\)\)/);
  assert.match(css, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*560px\)/);
  assert.match(css, /--tile-size:\s*min\(7vh,\s*3\.2rem\)/);
  assert.match(css, /\.replay-meta\s*\{[^}]*white-space:\s*pre-line/);
  assert.match(css, /\.replay-meta\s*\{[^}]*text-align:\s*center/);
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
  assert.match(app, /new URL\("\.\/replay\.html", document\.querySelector\('link\[rel="canonical"\]'\)\.href\)/);
  assert.match(app, /url\.searchParams\.set\("r", token\)/);
  assert.match(app, /\$\{replayLink\}/);
  assert.match(replayHtml, /id="reveal-button"[^>]*>Reveal guessed letters/);
  assert.doesNotMatch(replayHtml, /Tap below when you're ready to reveal the guessed letters/);
  assert.doesNotMatch(replayHtml, /replay-help/);
  assert.doesNotMatch(replayHtml, /Play Dailo/);
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
  const elements = Object.fromEntries(["replay-root", "replay-board", "replay-meta", "reveal-button", "replay-error"].map((id) => [id, new Element()]));
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

test("the game reserves space between its board and keyboard and hides the keyboard on completion", async () => {
  const [html, app, css] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/scripts/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8")
  ]);
  assert.match(html, /id="keyboard-wrap"/);
  assert.match(app, /keyboardWrap\.hidden = game\.status !== "playing"/);
  assert.match(css, /\.keyboard-wrap\[hidden\]\s*\{\s*display:\s*none !important/);
  assert.match(css, /\.game-card\s*\{[^}]*display:\s*flex/);
  assert.match(css, /\.board\s*\{[^}]*max-height:\s*calc\(100% - 1\.375rem\)/);
  assert.match(css, /\.board\s*\{[^}]*width:\s*min\(100%,\s*132cqh\)/);
});

test("the game scales lettering down in landscape and resamples viewport height after rotation", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../public/scripts/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8")
  ]);
  assert.match(css, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(min-width:\s*50rem\)/);
  assert.match(css, /\.tile\s*\{\s*font-size:\s*clamp\(\.9rem,\s*2\.6vh,\s*1\.35rem\)/);
  assert.match(css, /\.key\s*\{\s*font-size:\s*clamp\(\.65rem,\s*2vh,\s*\.95rem\)/);
  assert.match(app, /visualViewport\?\.addEventListener\("resize",\s*syncViewportHeight\)/);
  assert.match(app, /orientationSyncTimers\s*=\s*\[100,\s*260,\s*520\]/);
  assert.match(app, /setProperty\("--app-height",\s*`\$\{Math\.round\(height\)\}px`\)/);
  assert.match(app, /requestAnimationFrame\(\(\)\s*=>\s*\{\s*const settledHeight = window\.visualViewport\?\.height \|\| window\.innerHeight/);
  assert.match(app, /visualViewport\?\.addEventListener\("scroll",\s*syncViewportHeight\)/);
  assert.match(css, /\.app-shell\s*\{[^}]*position:\s*relative[^}]*height:\s*var\(--app-height\)/);
  assert.match(css, /\.app-shell\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.app-shell\s*\{[^}]*padding:\s*0 max\(\.7rem, env\(safe-area-inset-right\)\) 0 max\(\.7rem, env\(safe-area-inset-left\)\)/);
  assert.doesNotMatch(css, /\.app-shell\s*\{[^}]*padding-top:\s*env\(safe-area-inset-top\)/);
  assert.match(css, /@media\s*\(min-width:\s*27rem\)\s*\{\s*body::before\s*\{[^}]*top:\s*calc\(-1 \* env\(safe-area-inset-top\)\)[^}]*header-background\.png/);
  assert.match(css, /\.topbar::before\s*\{[^}]*header-background\.png/);
  assert.match(css, /\.topbar::before\s*\{\s*content:\s*none/);
  assert.doesNotMatch(css, /html\s*\{[^}]*overflow:\s*hidden/);
});

test("replay keeps a softly fading image header without extra labels", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../public/replay.html", import.meta.url), "utf8"),
    readFile(new URL("../public/replay.css", import.meta.url), "utf8")
  ]);
  assert.doesNotMatch(html, /THE COLORS TELL THE STORY|Shared replay/);
  assert.match(css, /body::before\s*\{[^}]*mask-image:\s*linear-gradient\(to bottom/);
});
