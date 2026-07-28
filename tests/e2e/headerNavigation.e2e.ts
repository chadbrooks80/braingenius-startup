import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { chromium, type Browser } from "playwright-core";

test(
  "the closed mobile navigation is inert and the open drawer is fully keyboard operable on the real home page",
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
      // The mobile trigger/drawer only render visibly below Tailwind's
      // `md` breakpoint (768px).
      await page.setViewportSize({ width: 390, height: 844 });

      await page.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });

      // `Header` renders two `HeaderNav` instances (one per breakpoint
      // container); both must resolve to distinct drawer IDs.
      const drawerIds = await page
        .locator('button[aria-label="Open menu"]')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-controls")));
      assert.equal(drawerIds.length, 2);
      assert.ok(drawerIds[0] && drawerIds[1], "every trigger must declare aria-controls");
      assert.notEqual(drawerIds[0], drawerIds[1], "each HeaderNav instance needs a unique drawer id");

      const trigger = page.locator('button[aria-label="Open menu"]:visible');
      await trigger.waitFor({ state: "visible" });
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");

      const drawerStates = () =>
        page.evaluate(
          (ids) =>
            ids.map((id) => {
              const el = document.getElementById(id as string) as (HTMLElement & { inert: boolean }) | null;
              return { id, inert: el?.inert ?? null, ariaHidden: el?.getAttribute("aria-hidden") ?? null };
            }),
          drawerIds
        );

      for (const state of await drawerStates()) {
        assert.equal(state.inert, true, `drawer ${state.id} must be inert while closed`);
        assert.equal(state.ariaHidden, "true", `drawer ${state.id} must be aria-hidden while closed`);
      }

      // Tabbing forward from the trigger while closed must never land
      // inside either drawer.
      await trigger.focus();
      await page.keyboard.press("Tab");
      const focusedInsideAnyDrawerWhileClosed = await page.evaluate((ids) => {
        const active = document.activeElement;
        return (ids as string[]).some((id) => document.getElementById(id)?.contains(active) ?? false);
      }, drawerIds);
      assert.equal(focusedInsideAnyDrawerWhileClosed, false);

      // Open: aria-expanded flips, the drawer becomes non-inert/visible,
      // and focus moves inside it.
      await trigger.focus();
      await trigger.click();
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");

      const openDrawerId = await trigger.getAttribute("aria-controls");
      const openState = await page.evaluate((id) => {
        const el = document.getElementById(id as string) as (HTMLElement & { inert: boolean }) | null;
        return { inert: el?.inert ?? null, ariaHidden: el?.getAttribute("aria-hidden") ?? null };
      }, openDrawerId);
      assert.equal(openState.inert, false);
      assert.equal(openState.ariaHidden, "false");

      const focusedInsideOpenDrawer = await page.evaluate(
        (id) => document.getElementById(id as string)?.contains(document.activeElement) ?? false,
        openDrawerId
      );
      assert.equal(focusedInsideOpenDrawer, true, "opening the drawer must move focus inside it");

      // Escape closes and restores focus to the trigger that opened it.
      await page.keyboard.press("Escape");
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      const activeAriaLabelAfterEscape = await page.evaluate(
        () => document.activeElement?.getAttribute("aria-label") ?? null
      );
      assert.equal(activeAriaLabelAfterEscape, "Open menu");

      // Backdrop click closes.
      await trigger.click();
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      await page.mouse.click(370, 700);
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");

      // Close-button click closes.
      await trigger.click();
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      await page.getByRole("button", { name: "Close menu" }).click();
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
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
