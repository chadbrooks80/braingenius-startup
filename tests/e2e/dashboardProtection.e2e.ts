import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { chromium, type Browser } from "playwright-core";

test(
  "anonymous /dashboard access is rejected by the proxy and the sign-in page does not loop",
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
      const page = await browser.newPage();

      // Anonymous top-level /dashboard redirects to /sign-in before any
      // dashboard content renders, carrying the requested path as the
      // existing sanitized `callbackUrl` return-path contract.
      await page.goto(`${origin}/dashboard`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      assert.equal(page.url(), `${origin}/sign-in?callbackUrl=%2Fdashboard`);
      await page.getByRole("heading", { name: "Welcome back" }).waitFor();
      assert.equal(await page.getByText("hello").count(), 0);

      // Anonymous nested /dashboard/... paths redirect the same way, before
      // the placeholder page (or its future nested children) ever render.
      await page.goto(`${origin}/dashboard/settings`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      assert.equal(
        page.url(),
        `${origin}/sign-in?callbackUrl=%2Fdashboard%2Fsettings`
      );
      await page.getByRole("heading", { name: "Welcome back" }).waitFor();

      // The sign-in page itself is never matched by the dashboard proxy
      // rule, so visiting it directly must not loop or redirect further.
      const response = await page.goto(`${origin}/sign-in`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      assert.ok(response);
      assert.equal(response.status(), 200);
      assert.equal(page.url(), `${origin}/sign-in`);
      await page.getByRole("heading", { name: "Welcome back" }).waitFor();
    } finally {
      await browser?.close();
      await stopNextApplication(app);
    }
  }
);

// Eligible signed-in dashboard access and unchanged signed-in onboarding
// routing (via the proxy's existing `getOnboardingRoute` redirect) are not
// covered by a browser test in this repository: there is no test database
// or seeded-user fixture this suite is authorized to use to establish a
// real NextAuth session, and adding one would require either contacting a
// real database or a test-only authentication bypass, both excluded by
// this project's testing rules. `tests/auth/sessionRefresh.test.ts` and
// `tests/auth/gettingStartedPage.test.ts` cover the onboarding-routing and
// session-refresh contracts this proxy change preserves at the unit level.
// This is a documented limitation, not a registered test -- a placeholder
// assertion here would count as passing browser coverage it never performed.

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
