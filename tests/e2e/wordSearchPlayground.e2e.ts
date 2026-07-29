import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import {
  chromium,
  type Browser,
  type CDPSession,
  type Locator,
  type Page,
} from "playwright-core";

const PLAYGROUND_ROUTE = "/le-playground";
const SMALL_PUZZLE_WORDS = ["cat", "dog", "sun", "map"];
const DUPLICATE_DIAGNOSTIC_PREFIX =
  "[WordSearchWindow] Removed duplicate target input:";

type Cell = { row: number; col: number };
type WordPath = { start: Cell; end: Cell };

const DIRECTION_STEPS: Cell[] = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 0, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: -1 },
];

test(
  "the current le-playground route completes Word Search across desktop and narrow touch layouts",
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
      const context = await browser.newContext({
        hasTouch: true,
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      const browserErrors: string[] = [];
      const duplicateDiagnostics: string[] = [];

      page.on("pageerror", (error) =>
        browserErrors.push(error.stack ?? error.message)
      );
      page.on("console", (message) => {
        if (message.type() !== "error") {
          return;
        }

        if (message.text().startsWith(DUPLICATE_DIAGNOSTIC_PREFIX)) {
          duplicateDiagnostics.push(message.text());
        } else {
          browserErrors.push(message.text());
        }
      });

      await page.goto(`${origin}${PLAYGROUND_ROUTE}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      const card = playgroundCard(page, "Word search: small puzzle");
      const grid = card.getByRole("grid");
      await grid.waitFor({ state: "visible", timeout: 15_000 });

      const letters = await readGridLetters(grid);
      const paths = new Map(
        SMALL_PUZZLE_WORDS.map((word) => [
          word,
          findWordPath(letters, word.toUpperCase()),
        ])
      );
      const nextButton = card.getByRole("button", { name: "Next →" });

      assert.equal(await nextButton.isDisabled(), true);
      const desktopScrollMetrics = await grid
        .locator("..")
        .locator("..")
        .evaluate((area) => ({
          clientWidth: area.clientWidth,
          scrollWidth: area.scrollWidth,
        }));
      assert.ok(
        desktopScrollMetrics.scrollWidth <= desktopScrollMetrics.clientWidth
      );
      assert.equal(
        await grid.evaluate((element) =>
          getComputedStyle(element.parentElement as HTMLElement).touchAction
        ),
        "none"
      );

      const catPath = paths.get("cat")!;
      await dragBetweenCells(page, grid, catPath.start, stepOnce(catPath));
      await card
        .getByText("That's not one of your words. Keep looking!")
        .waitFor({ timeout: 5_000 });
      await card.getByText("0 of 4 found").waitFor({ timeout: 5_000 });

      await dragBetweenCells(page, grid, catPath.start, catPath.end);
      await card.getByText("1 of 4 found").waitFor({ timeout: 5_000 });

      const dogPath = paths.get("dog")!;
      await selectWithKeyboard(page, grid, dogPath);
      await card.getByText("2 of 4 found").waitFor({ timeout: 5_000 });

      const focusedCell = grid.locator("[data-ws-cell]:focus");
      assert.equal(
        await focusedCell.evaluate(
          (cell) => getComputedStyle(cell).outlineStyle !== "none"
        ),
        true
      );

      await page.setViewportSize({ width: 390, height: 844 });
      const sunPath = paths.get("sun")!;
      const pageScrollBeforeTouch = await page.evaluate(() => window.scrollY);
      await touchDragBetweenCells(cdp, grid, sunPath.start, sunPath.end);
      await card.getByText("3 of 4 found").waitFor({ timeout: 5_000 });
      const pageScrollAfterTouch = await page.evaluate(() => window.scrollY);
      assert.ok(Math.abs(pageScrollAfterTouch - pageScrollBeforeTouch) < 2);

      const mapPath = paths.get("map")!;
      await dragBetweenCells(page, grid, mapPath.end, mapPath.start);
      await card.getByText("4 of 4 found").waitFor({ timeout: 5_000 });
      await card.getByRole("status").getByText("You found every word!").waitFor();
      assert.equal(await nextButton.isEnabled(), true);
      assert.equal(
        await card.locator("ul li span.line-through").count(),
        SMALL_PUZZLE_WORDS.length
      );
      assert.match(
        (await cellLocator(grid, catPath.start).getAttribute("aria-label")) ?? "",
        /found word/
      );

      const duplicateCard = playgroundCard(
        page,
        "Word search: duplicate input"
      );
      await duplicateCard.getByRole("grid").waitFor({ timeout: 10_000 });
      assert.deepEqual(
        await duplicateCard.locator("ul li").allTextContents(),
        ["Fraction", "decimal"]
      );
      await duplicateCard.getByText("0 of 2 found").waitFor();
      assert.equal(duplicateDiagnostics.length, 1);
      assert.match(duplicateDiagnostics[0], /FRACTION, DECIMAL/);

      await playgroundCard(page, "Word search: loading")
        .getByText("Building your word search…")
        .waitFor({ timeout: 5_000 });

      const failureCard = playgroundCard(
        page,
        "Word search: generation failure"
      );
      await failureCard
        .getByText("We couldn't build your puzzle. Please try again.")
        .waitFor({ timeout: 10_000 });
      await failureCard.getByRole("button", { name: "Retry" }).click();
      await failureCard.getByRole("grid").waitFor({ timeout: 10_000 });

      const completedCard = playgroundCard(page, "Word search: completed");
      await completedCard
        .getByText("You found every word!")
        .waitFor({ timeout: 10_000 });
      assert.equal(
        await completedCard
          .getByRole("button", { name: "Next →" })
          .isEnabled(),
        true
      );

      const narrowCard = playgroundCard(page, "Word search: narrow screen");
      const narrowGrid = narrowCard.getByRole("grid");
      await narrowGrid.waitFor({ state: "visible", timeout: 10_000 });
      const narrowScrollArea = narrowGrid.locator("..").locator("..");
      const scrollMetrics = await narrowScrollArea.evaluate((area) => ({
        clientWidth: area.clientWidth,
        scrollWidth: area.scrollWidth,
      }));
      assert.ok(scrollMetrics.scrollWidth > scrollMetrics.clientWidth);
      await narrowGrid.locator('[data-ws-cell="9:9"]').scrollIntoViewIfNeeded();
      await narrowCard
        .getByRole("button", { name: "Next →" })
        .scrollIntoViewIfNeeded();
      assert.equal(
        await narrowCard.getByRole("button", { name: "Next →" }).isVisible(),
        true
      );

      assert.equal(page.url(), `${origin}${PLAYGROUND_ROUTE}`);
      assert.deepEqual(browserErrors, []);
    } finally {
      await browser?.close();
      await stopNextApplication(app);
    }
  }
);

function playgroundCard(page: Page, title: string): Locator {
  return page.locator("div.max-w-2xl", {
    has: page.getByRole("heading", { name: title, exact: true }),
  });
}

function cellLocator(grid: Locator, cell: Cell): Locator {
  return grid.locator(`[data-ws-cell="${cell.row}:${cell.col}"]`);
}

async function readGridLetters(grid: Locator): Promise<string[][]> {
  const entries = await grid
    .locator("[data-ws-cell]")
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        key: node.getAttribute("data-ws-cell") ?? "",
        letter: node.textContent ?? "",
      }))
    );
  const size = Math.sqrt(entries.length);
  assert.ok(Number.isInteger(size));
  const letters: string[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => "")
  );

  for (const { key, letter } of entries) {
    const [row, col] = key.split(":").map(Number);
    letters[row][col] = letter;
  }

  return letters;
}

function findWordPath(letters: string[][], word: string): WordPath {
  const matches: WordPath[] = [];

  for (let row = 0; row < letters.length; row += 1) {
    for (let col = 0; col < letters.length; col += 1) {
      for (const step of DIRECTION_STEPS) {
        const endRow = row + step.row * (word.length - 1);
        const endCol = col + step.col * (word.length - 1);

        if (
          endRow < 0 ||
          endRow >= letters.length ||
          endCol < 0 ||
          endCol >= letters.length
        ) {
          continue;
        }

        const spelled = Array.from({ length: word.length }, (unused, index) =>
          letters[row + step.row * index][col + step.col * index]
        ).join("");

        if (spelled === word) {
          matches.push({
            start: { row, col },
            end: { row: endRow, col: endCol },
          });
        }
      }
    }
  }

  assert.equal(matches.length, 1, `Expected one visible occurrence of ${word}.`);
  return matches[0];
}

function stepOnce(path: WordPath): Cell {
  return {
    row: path.start.row + Math.sign(path.end.row - path.start.row),
    col: path.start.col + Math.sign(path.end.col - path.start.col),
  };
}

async function selectWithKeyboard(
  page: Page,
  grid: Locator,
  path: WordPath
): Promise<void> {
  await cellLocator(grid, path.start).focus();
  await page.keyboard.press("Enter");
  const rowKey =
    path.end.row > path.start.row
      ? "ArrowDown"
      : path.end.row < path.start.row
        ? "ArrowUp"
        : null;
  const colKey =
    path.end.col > path.start.col
      ? "ArrowRight"
      : path.end.col < path.start.col
        ? "ArrowLeft"
        : null;
  const stepCount = Math.max(
    Math.abs(path.end.row - path.start.row),
    Math.abs(path.end.col - path.start.col)
  );

  for (let step = 0; step < stepCount; step += 1) {
    if (rowKey) await page.keyboard.press(rowKey);
    if (colKey) await page.keyboard.press(colKey);
  }

  await page.keyboard.press("Enter");
}

async function cellCenter(grid: Locator, cell: Cell) {
  const locator = cellLocator(grid, cell);
  const box = await locator.boundingBox();
  assert.ok(box);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragBetweenCells(
  page: Page,
  grid: Locator,
  from: Cell,
  to: Cell
): Promise<void> {
  await cellLocator(grid, to).scrollIntoViewIfNeeded();
  const start = await cellCenter(grid, from);
  const end = await cellCenter(grid, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function touchDragBetweenCells(
  cdp: CDPSession,
  grid: Locator,
  from: Cell,
  to: Cell
): Promise<void> {
  await cellLocator(grid, to).scrollIntoViewIfNeeded();
  const start = await cellCenter(grid, from);
  const end = await cellCenter(grid, to);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: start.x, y: start.y }],
  });
  await new Promise((resolve) => setTimeout(resolve, 50));

  for (let step = 1; step <= 8; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: start.x + ((end.x - start.x) * step) / 8,
          y: start.y + ((end.y - start.y) * step) / 8,
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  await new Promise((resolve) => setTimeout(resolve, 50));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
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
