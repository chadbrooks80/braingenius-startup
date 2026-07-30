import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { chromium, type Browser } from "playwright-core";

const APP_ROUTE = "/learning/vocabulary/word_list_id";
const CONTENT_PATH = "/api/learning/vocabulary/content";
const ANSWER_PATH = "/api/learning/vocabulary/submit-answer";
const SPEECH_PATH = "/api/learning/vocabulary/speech";
const TTS_PATH = "/api/tts";

// Vocabulary is now a subscription-protected registered module (Phase 1,
// subscription-tier-module-access): an anonymous caller can no longer reach
// or complete the lesson at all, so this test no longer drives a full
// anonymous playthrough. It proves the new anonymous boundary honestly at
// both the route (server redirect before any client Learning Engine
// initialization) and the three direct Vocabulary HTTP boundaries (401
// before any content creation, capability mutation, grading, or TTS
// dispatch). Full real-module/real-handler lesson-completion coverage
// (introduction, mastery, reviews, checkpoints, completion) remains proven
// without a browser by `tests/integration/vocabularyRouteSmoke.test.ts`,
// which exercises the real module and real content/answer handlers
// directly and is unaffected by this HTTP-layer access change.
//
// An equivalent authenticated-browser flow (a real signed-in session with a
// real entitled MONTHLY/LIFETIME/ADMIN subscription reaching lesson
// completion through the real route) is not covered here: it would require
// seeding a real database user through the real credentials sign-in UI, and
// this repository's disposable-database guard (see
// `tests/auth/atomicAuthDatabase.integration.test.ts`) does not treat the
// configured `DATABASE_URL` as an approved local/test-named disposable
// database in this environment. Adding a real-database authenticated
// browser flow without that guard would risk mutating a shared database, so
// it is reported as a limitation rather than implemented.
test(
  "an anonymous browser cannot reach or complete the paid Vocabulary lesson",
  { timeout: 60_000 },
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
      const page = await browser.newPage();

      const protectedApiResponses: Array<{ path: string; status: number }> = [];
      page.on("response", (response) => {
        const path = new URL(response.url()).pathname;
        if ([CONTENT_PATH, ANSWER_PATH, SPEECH_PATH, TTS_PATH].includes(path)) {
          protectedApiResponses.push({ path, status: response.status() });
        }
      });

      await page.goto(`${origin}${APP_ROUTE}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      // The server access boundary redirects before any client Learning
      // Engine initialization runs, so the lesson start button never
      // renders and no Vocabulary/TTS API boundary is ever called.
      await page.waitForURL((url) => url.pathname === "/sign-in", {
        timeout: 15_000,
      });
      const signInUrl = new URL(page.url());
      assert.equal(signInUrl.searchParams.get("callbackUrl"), APP_ROUTE);

      const startButtonVisible = await page
        .getByRole("button", { name: "Start Lesson" })
        .isVisible()
        .catch(() => false);
      assert.equal(
        startButtonVisible,
        false,
        "the anonymous route must never render the Learning Engine lesson experience"
      );
      assert.deepEqual(
        protectedApiResponses,
        [],
        "an anonymous page load must never reach a Vocabulary or TTS API boundary"
      );

      // Direct anonymous API calls independently fail closed too, before
      // any content creation, capability mutation, grading, or TTS
      // acquisition/dispatch.
      const directContent = await page.request.post(`${origin}${CONTENT_PATH}`, {
        data: { contentType: "manifest", wordListId: "word_list_id" },
      });
      assert.equal(directContent.status(), 401);

      const directAnswer = await page.request.post(`${origin}${ANSWER_PATH}`, {
        data: { answerType: "definition", attemptId: "attempt-1", selectedChoiceId: "a" },
      });
      assert.equal(directAnswer.status(), 401);

      const directSpeech = await page.request.post(`${origin}${SPEECH_PATH}`, {
        data: { reference: "attempt-1" },
      });
      assert.equal(directSpeech.status(), 401);
    } finally {
      await browser?.close();
      await stopNextApplication(app);
    }
  }
);

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
