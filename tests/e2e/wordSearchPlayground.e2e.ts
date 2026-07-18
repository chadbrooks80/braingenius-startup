import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { chromium, type Browser, type Locator, type Page } from "playwright-core";

const PLAYGROUND_ROUTE = "/playground";
const SMALL_PUZZLE_WORDS = ["cat", "dog", "sun", "map"];

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
  "the playground word search supports real mouse, keyboard, and touch selection",
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
      const context = await browser.newContext({ hasTouch: true });
      const page = await context.newPage();
      const browserErrors: string[] = [];
      page.on("pageerror", (error) =>
        browserErrors.push(error.stack ?? error.message)
      );

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
      assert.equal(
        await nextButton.isDisabled(),
        true,
        "Next must be locked before completion."
      );

      // An incorrect two-letter drag clears with neutral feedback.
      const catPath = paths.get("cat")!;
      await dragBetweenCells(page, grid, catPath.start, {
        row: catPath.start.row + Math.sign(catPath.end.row - catPath.start.row),
        col: catPath.start.col + Math.sign(catPath.end.col - catPath.start.col),
      });
      await card
        .getByText("That's not one of your words. Keep looking!")
        .waitFor({ timeout: 5_000 });
      await card.getByText("0 of 4 found").waitFor({ timeout: 5_000 });

      // Mouse drag.
      await dragBetweenCells(page, grid, catPath.start, catPath.end);
      await card.getByText("1 of 4 found").waitFor({ timeout: 5_000 });

      // Keyboard: focus the start cell, anchor with Enter, extend with the
      // arrow keys, and commit with Enter.
      const dogPath = paths.get("dog")!;
      await cellLocator(grid, dogPath.start).focus();
      await page.keyboard.press("Enter");
      const rowKey =
        dogPath.end.row > dogPath.start.row
          ? "ArrowDown"
          : dogPath.end.row < dogPath.start.row
            ? "ArrowUp"
            : null;
      const colKey =
        dogPath.end.col > dogPath.start.col
          ? "ArrowRight"
          : dogPath.end.col < dogPath.start.col
            ? "ArrowLeft"
            : null;
      const stepCount = Math.max(
        Math.abs(dogPath.end.row - dogPath.start.row),
        Math.abs(dogPath.end.col - dogPath.start.col)
      );
      // Diagonal placements move one arrow per axis per step; the selection
      // preview snaps back onto the line whenever the cursor realigns, and
      // the final Enter commits from the anchor to the end cell.
      for (let step = 0; step < stepCount; step += 1) {
        if (rowKey) await page.keyboard.press(rowKey);
        if (colKey) await page.keyboard.press(colKey);
      }
      await page.keyboard.press("Enter");
      await card.getByText("2 of 4 found").waitFor({ timeout: 5_000 });

      // Touch: tap the first and last letters.
      const sunPath = paths.get("sun")!;
      await tapCell(page, grid, sunPath.start);
      await tapCell(page, grid, sunPath.end);
      await card.getByText("3 of 4 found").waitFor({ timeout: 5_000 });

      // Reverse mouse drag on the final word.
      const mapPath = paths.get("map")!;
      await dragBetweenCells(page, grid, mapPath.end, mapPath.start);
      await card.getByText("4 of 4 found").waitFor({ timeout: 5_000 });

      await card.getByText("You found every word!").waitFor({ timeout: 5_000 });
      assert.equal(
        await nextButton.isEnabled(),
        true,
        "Next must unlock after completion."
      );

      const crossedWords = await card
        .locator("ul li span.line-through")
        .count();
      assert.equal(crossedWords, SMALL_PUZZLE_WORDS.length);

      // The loading example keeps showing its loading state.
      await playgroundCard(page, "Word search: loading")
        .getByText("Building your word search…")
        .waitFor({ timeout: 5_000 });

      // The failure example shows the learner-safe error and recovers
      // through explicit Retry clicks.
      const failureCard = playgroundCard(
        page,
        "Word search: generation failure"
      );
      await failureCard
        .getByText("We couldn't build your puzzle. Please try again.")
        .waitFor({ timeout: 10_000 });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await failureCard.getByRole("grid").isVisible()) {
          break;
        }
        await failureCard.getByRole("button", { name: "Retry" }).click();
        await page.waitForTimeout(300);
      }
      await failureCard.getByRole("grid").waitFor({ timeout: 10_000 });

      // The completed example unlocks Next without interaction.
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
  assert.ok(Number.isInteger(size), "The rendered grid must be square.");

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
  const size = letters.length;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      for (const step of DIRECTION_STEPS) {
        const endRow = row + step.row * (word.length - 1);
        const endCol = col + step.col * (word.length - 1);

        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) {
          continue;
        }

        const spelled = Array.from({ length: word.length }, (unused, index) =>
          letters[row + step.row * index][col + step.col * index]
        ).join("");

        if (spelled === word) {
          return { start: { row, col }, end: { row: endRow, col: endCol } };
        }
      }
    }
  }

  assert.fail(`The playground grid does not contain "${word}".`);
}

async function cellCenter(grid: Locator, cell: Cell) {
  const locator = cellLocator(grid, cell);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box, `Cell ${cell.row}:${cell.col} must be visible.`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function dragBetweenCells(
  page: Page,
  grid: Locator,
  from: Cell,
  to: Cell
) {
  const start = await cellCenter(grid, from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();

  const end = await cellCenter(grid, to);
  await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, {
    steps: 4,
  });
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
}

async function tapCell(page: Page, grid: Locator, cell: Cell) {
  const point = await cellCenter(grid, cell);
  await page.touchscreen.tap(point.x, point.y);
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
