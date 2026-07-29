import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { chromium, type Browser, type Page, type Route } from "playwright-core";

const APP_ROUTE = "/learning/vocabulary/word_list_id";
const TTS_PATH = "/api/tts";

type Mode = "fail" | "succeed" | "hang";

type HangGate = {
  release: () => void;
  // Resolves once this specific stale/hanging request's mocked response has
  // actually been sent through the route (or discarded because the browser
  // already aborted it). Releasing a gate and awaiting `settled` is process
  // hygiene, not a correctness dependency: by the time a gate is released in
  // this test, the request it belongs to has already been made stale by a
  // synchronous cancelSpeech()/replacement on the client, so its eventual
  // resolution can no longer affect the currently active notice.
  settled: Promise<void>;
};

// Polls a real condition instead of guessing a fixed delay. This is the same
// category of technique Playwright's own auto-waiting locator methods use
// internally; the timeout is a safety net, never the synchronization
// mechanism itself.
async function waitForCondition(
  predicate: () => boolean | Promise<boolean>,
  description: string,
  timeoutMs = 10_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() >= deadline) {
      assert.fail(`Timed out waiting for: ${description}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// Reads the shared banner's own `data-timer-armed-for` attribute, scoped to
// our banner (not Next.js's unrelated hidden route-announcer, which also
// carries role="alert"). This attribute is set inside the banner's effect
// the same render pass its 12-second dismissal timer is installed, so a
// change in its value is a real, observable proof that React committed a
// replacement notice and armed its timer -- not a guess about how long that
// takes.
function readBannerArmedFor(): string | null {
  const element = [...document.querySelectorAll('[role="alert"]')].find(
    (candidate) => candidate.textContent?.includes("Audio couldn")
  );
  return element?.getAttribute("data-timer-armed-for") ?? null;
}

async function getArmedFor(page: Page): Promise<string | null> {
  return page.evaluate(readBannerArmedFor);
}

// Waits until the banner's armed-for value differs from `previous`. Safe to
// call while `page.clock` is installed: `page.evaluate` executes directly
// over the protocol and does not depend on the page's (faked)
// requestAnimationFrame/setTimeout, unlike `page.waitForFunction`'s default
// "raf" polling.
async function waitForArmedForChange(
  page: Page,
  previous: string | null
): Promise<void> {
  await waitForCondition(
    async () => (await getArmedFor(page)) !== previous,
    `the banner's timer to arm for a notice different from ${previous ?? "null"}`
  );
}

test(
  "the real learning route shows, replaces, dismisses, times out, and clears the shared speech-failure banner",
  { timeout: 180_000 },
  async () => {
    const port = await reservePort();
    const origin = `http://127.0.0.1:${port}`;
    const app = startNextApplication(port);
    let browser: Browser | null = null;

    try {
      await waitForApplication(origin, app);
      browser = await chromium.launch({
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        headless: true,
        args: ["--no-proxy-server"],
      });
      const page = await browser.newPage({
        hasTouch: true,
        viewport: { width: 1280, height: 800 },
      });

      // Only real uncaught exceptions/unhandled rejections are tracked here.
      // This test deliberately makes /api/tts return 500, which Chrome also
      // logs as a benign "Failed to load resource" console error; that
      // expected network-failure logging is not a page error.
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.stack ?? error.message));

      // Every /api/tts request is fulfilled entirely client-side by this
      // interception, so the real route/provider is never contacted and no
      // authentication/entitlement is required for this feature test.
      // `requestCount` and `hangGates` are the explicit observable
      // synchronization points this test uses in place of fixed delays: the
      // former proves a request actually reached the route, the latter's
      // `settled` promise proves a released stale request's Node-side
      // handling has completed.
      let mode: Mode = "fail";
      let requestCount = 0;
      const hangGates: HangGate[] = [];
      await page.route(`**${TTS_PATH}`, async (route: Route) => {
        requestCount += 1;
        if (mode === "hang") {
          let release!: () => void;
          const gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          const settled = (async () => {
            await gate;
            await route
              .fulfill({ status: 500, contentType: "text/plain", body: "" })
              .catch(() => {});
          })();
          hangGates.push({ release, settled });
          await settled;
          return;
        }
        if (mode === "fail") {
          await route.fulfill({ status: 500, contentType: "text/plain", body: "" });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "audio/wav",
          body: createSilentWavBuffer(),
        });
      });

      await page.goto(`${origin}${APP_ROUTE}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      const startButton = page.getByRole("button", { name: "Start Lesson" });
      await startButton.waitFor({ state: "visible", timeout: 15_000 });
      await clickAndWaitForScreenChange(page, startButton);

      await page.getByText("Meet Your New Word", { exact: true }).waitFor();

      // Next.js's own hidden route announcer also carries role="alert", so
      // this locator must be scoped to the banner's own text to avoid a
      // strict-mode collision with that unrelated element.
      const alert = page.getByRole("alert").filter({ hasText: "Audio couldn" });
      const replay = page.getByRole("button", { name: "Hear pronunciation" });
      const dismiss = page.getByRole("button", { name: "Dismiss audio error" });

      // 1) A current non-OK speech request shows exactly one top-level alert
      // with the exact learner-safe message and no status/body/technical text.
      await alert.waitFor({ state: "visible" });
      assert.equal(await alert.count(), 1);
      const alertText = await alert.innerText();
      assert.match(alertText, /^Audio couldn.t play\. Please try again\.$/);
      for (const forbidden of ["500", "undefined", "NaN", "fetch", "TypeError"]) {
        assert.doesNotMatch(alertText, new RegExp(forbidden));
      }
      await assertBannerDoesNotObscureControls(page, alert, replay);

      // 2) The accessible X has a visible keyboard focus treatment and
      // activates from the keyboard.
      await dismiss.focus();
      assert.equal(
        await dismiss.evaluate((element) => element.matches(":focus-visible")),
        true
      );
      assert.notEqual(
        await dismiss.evaluate((element) => getComputedStyle(element).boxShadow),
        "none"
      );
      await page.keyboard.press("Enter");
      await alert.waitFor({ state: "hidden" });

      // 3) A later failure (a fresh replay) shows it again, remains usable at
      // a representative narrow viewport, and can be dismissed by touch.
      await replay.click();
      await alert.waitFor({ state: "visible" });
      assert.equal(await alert.count(), 1);
      await page.setViewportSize({ width: 390, height: 844 });
      await assertBannerDoesNotObscureControls(page, alert, replay);
      const dismissBox = await dismiss.boundingBox();
      assert.ok(dismissBox);
      await page.touchscreen.tap(
        dismissBox.x + dismissBox.width / 2,
        dismissBox.y + dismissBox.height / 2
      );
      await alert.waitFor({ state: "hidden" });
      await page.setViewportSize({ width: 1280, height: 800 });

      // 4) Two active failures never create stacked duplicate alerts: a
      // second rapid replay replaces the one active generation. Wait for
      // both requests to actually reach the route and for the surviving
      // generation's own timer to arm before asserting there is only one.
      const priorRequestCountBeforeDoubleClick = requestCount;
      const armedBeforeDoubleClick = await getArmedFor(page);
      await replay.click();
      await replay.click();
      await waitForCondition(
        () => requestCount >= priorRequestCountBeforeDoubleClick + 2,
        "both rapid replay requests to reach the TTS route"
      );
      await waitForArmedForChange(page, armedBeforeDoubleClick);
      assert.equal(await alert.count(), 1);

      // 5) The latest failure gets its own fresh 12-second lifetime, and an
      // old timer cannot dismiss a newer notice: retrigger partway through
      // the first notice's lifetime, then prove it survives past the first
      // notice's original deadline before disappearing at its own deadline.
      await dismiss.click();
      await alert.waitFor({ state: "hidden" });
      await page.clock.install();
      const armedBeforeNoticeA = await getArmedFor(page);
      await replay.click(); // notice A starts
      await alert.waitFor({ state: "visible" });
      await waitForArmedForChange(page, armedBeforeNoticeA);
      const armedForNoticeA = await getArmedFor(page);
      await page.clock.runFor(8_000);
      assert.equal(await alert.isVisible(), true, "notice A must still be visible before its own 12s boundary");
      await replay.click(); // notice B replaces A at ~8s, with a fresh 12s lifetime
      // Prove React committed the replacement and armed notice B's own timer
      // before advancing the clock any further.
      await waitForArmedForChange(page, armedForNoticeA);
      await page.clock.runFor(5_000); // ~13s since A started; A's naive 12s deadline has passed
      assert.equal(
        await alert.isVisible(),
        true,
        "an old timer belonging to notice A must not dismiss the newer notice B"
      );
      await page.clock.runFor(7_001); // just beyond B's own 12s lifetime
      await alert.waitFor({ state: "hidden", timeout: 2_000 });

      // 6) A controlled successful retry clears the current alert. Still on
      // the definition-display screen, using its manual replay control.
      mode = "fail";
      await replay.click();
      await alert.waitFor({ state: "visible" });
      mode = "succeed";
      await replay.click();
      await alert.waitFor({ state: "hidden", timeout: 15_000 });

      // 7) A same-screen replacement makes the old request's late failure
      // inert while the newer active failure owns the one current alert.
      mode = "hang";
      const priorRequestCountBeforeHang1 = requestCount;
      await replay.click();
      await waitForCondition(
        () => requestCount > priorRequestCountBeforeHang1,
        "the hanging request to reach the TTS route"
      );
      mode = "fail";
      const armedBeforeReplacement1 = await getArmedFor(page);
      await replay.click();
      await alert.waitFor({ state: "visible" });
      await waitForArmedForChange(page, armedBeforeReplacement1);
      const replacedGate1 = hangGates.shift();
      assert.ok(replacedGate1);
      replacedGate1.release();
      await replacedGate1.settled;
      assert.equal(
        await alert.count(),
        1,
        "a replaced request's late failure must not add or replace the active alert"
      );
      await dismiss.click();
      await alert.waitFor({ state: "hidden" });

      // 8) An intentionally canceled request (screen change) shows no late
      // alert: start a hanging request, change screens before it resolves,
      // then release it late and confirm nothing appears beyond the new
      // screen's own independent failure.
      mode = "hang";
      const priorRequestCountBeforeHang2 = requestCount;
      await replay.click();
      await waitForCondition(
        () => requestCount > priorRequestCountBeforeHang2,
        "the hanging request (before screen change) to reach the TTS route"
      );
      mode = "fail";
      const next = page.getByRole("button", { name: "Next →" });
      await clickAndWaitForScreenChange(page, next);
      await page
        .getByText("Fun Fact About This Word!", { exact: true })
        .waitFor();
      // The new fun-fact screen speaks automatically and its own request
      // fails immediately under the current "fail" mode.
      await alert.waitFor({ state: "visible" });
      // Release the old, now-stale, hanging generation's request late. This
      // is process hygiene only: the screen change already canceled/aborted
      // it synchronously on the client, well before this release.
      await Promise.all(
        hangGates.splice(0).map((gate) => {
          gate.release();
          return gate.settled;
        })
      );
      assert.equal(await alert.count(), 1, "a stale replaced request must never add a second alert");

      assert.equal(browserErrors.length, 0, `Unexpected browser errors: ${browserErrors.join("\n")}`);
    } finally {
      await browser?.close();
      await stopNextApplication(app);
    }
  }
);

async function assertBannerDoesNotObscureControls(
  page: Page,
  alert: ReturnType<Page["getByRole"]>,
  primaryControl: ReturnType<Page["getByRole"]>
): Promise<void> {
  const [alertBox, controlBox] = await Promise.all([
    alert.boundingBox(),
    primaryControl.boundingBox(),
  ]);
  assert.ok(alertBox);
  assert.ok(controlBox);
  assert.ok(alertBox.x >= 0);
  assert.ok(alertBox.x + alertBox.width <= (await page.evaluate(() => innerWidth)) + 1);
  assert.equal(rectanglesOverlap(alertBox, controlBox), false);
}

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

// A minimal, real, decodable silent WAV (PCM16 mono) so Chrome's real
// <audio> element actually fires "ended" for the controlled success path,
// rather than "error" from an invalid fixture.
function createSilentWavBuffer(durationSeconds = 0.05, sampleRate = 8000): Buffer {
  const numChannels = 1;
  const bytesPerSample = 2;
  const numSamples = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const byteRate = sampleRate * numChannels * bytesPerSample;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

async function clickAndWaitForScreenChange(
  page: Page,
  button: ReturnType<Page["getByRole"]>
): Promise<void> {
  const element = await button.elementHandle();
  assert.ok(element);
  await element.evaluate((node: HTMLButtonElement) => node.click());
  await page.waitForFunction((node) => !node.isConnected, element);
}

async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function startNextApplication(port: number): ChildProcessWithoutNullStreams {
  return spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        GOOGLE_TTS_CLIENT_EMAIL: "",
        GOOGLE_TTS_PRIVATE_KEY: "",
        GOOGLE_TTS_PROJECT_ID: "",
        LEMONFOX_API_KEY: "",
      },
      stdio: "pipe",
      detached: true,
    }
  );
}

async function waitForApplication(
  origin: string,
  app: ChildProcessWithoutNullStreams
): Promise<void> {
  let logs = "";
  app.stdout.on("data", (chunk) => {
    logs = `${logs}${String(chunk)}`.slice(-20_000);
  });
  app.stderr.on("data", (chunk) => {
    logs = `${logs}${String(chunk)}`.slice(-20_000);
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (app.exitCode !== null) {
      assert.fail(`Next.js exited before becoming ready.\n${logs}`);
    }
    try {
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`Next.js did not become ready.\n${logs}`);
}

async function stopNextApplication(
  app: ChildProcessWithoutNullStreams
): Promise<void> {
  if (app.exitCode !== null) return;
  if (app.pid) process.kill(-app.pid, "SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => app.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (app.exitCode === null && app.pid) process.kill(-app.pid, "SIGKILL");
}
