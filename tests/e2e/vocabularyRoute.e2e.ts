import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";
import { chromium, type Browser, type Page } from "playwright-core";

const APP_ROUTE = "/learning/vocabulary/word_list_id";
const CONTENT_PATH = "/api/learning/vocabulary/content";
const ANSWER_PATH = "/api/learning/vocabulary/submit-answer";
const SPEECH_PATH = "/api/learning/vocabulary/speech";
const TTS_PATH = "/api/tts";

type ContentBody = Record<string, unknown> & { contentType: string };
type Choice = { id: string; text: string };

test(
  "the running vocabulary route completes through the real engine, windows, and HTTP handlers",
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
      const traffic = observeVocabularyTraffic(page);
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.stack ?? error.message));
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });

      await page.goto(`${origin}${APP_ROUTE}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      const startButton = page.getByRole("button", { name: "Start Lesson" });
      try {
        await startButton.waitFor({ state: "visible", timeout: 15_000 });
      } catch {
        assert.fail(
          `The real route did not initialize. Body: ${await page.locator("body").innerText()}\n` +
            `Traffic: ${JSON.stringify(traffic.snapshot())}\n` +
            `Browser errors: ${browserErrors.join("\n")}`
        );
      }
      await clickAndWaitForScreenChange(page, startButton);

      const introducedWords = new Set<string>();
      const learnedSpellingAnswers = new Map<string, string>();
      const correctDefinitionChoice = new Map<string, string>();
      const visitedWindows = new Set<string>(["startup"]);
      let answerRecaps = 0;
      let definitionReviews = 0;
      let spellingReviews = 0;
      let sawWordReplacement = false;

      for (let guard = 0; guard < 2_000; guard += 1) {
        if (await isVisible(page, "heading", "Lesson complete")) {
          visitedWindows.add("lesson-complete");
          break;
        }

        if (await page.getByText("Meet Your New Word", { exact: true }).isVisible()) {
          visitedWindows.add("definition-display");
          const visibleWord = await page.locator("span.font-display.text-5xl").innerText();
          const content = await traffic.waitForContent(
            "definition-display",
            (candidate) => candidate.word === visibleWord
          );
          const word = requiredString(content.word, "definition-display word");
          requiredString(content.definition, "definition-display definition");
          introducedWords.add(word);
          if (introducedWords.size > 5) sawWordReplacement = true;
          await clickNext(page);
          continue;
        }

        if (
          await page
            .getByText("Fun Fact About This Word!", { exact: true })
            .isVisible()
        ) {
          visitedWindows.add("definition-fun-fact");
          const visibleWord = await page.locator("span.font-display.text-3xl").innerText();
          await traffic.waitForContent(
            "definition-fun-fact",
            (candidate) => candidate.word === visibleWord
          );
          await clickNext(page);
          continue;
        }

        if (
          await page
            .getByText("What does this word mean?", { exact: true })
            .isVisible()
        ) {
          visitedWindows.add("multiple-choice");
          if (await page.getByText("Definition review", { exact: true }).isVisible()) {
            definitionReviews += 1;
          }
          const visibleQuestion = await page.locator("span.font-display.text-4xl").innerText();
          const content = await traffic.waitForContent(
            "definition-practice",
            (candidate) => candidate.question === visibleQuestion
          );
          const question = requiredString(content.question, "definition question");
          const choices = requiredChoices(content.choices);
          const selectedText = correctDefinitionChoice.get(question) ?? choices[0].text;
          const responsePromise = page.waitForResponse(isAnswerResponse);

          await page.getByRole("button", { name: selectedText, exact: true }).click();
          const answer = (await (await responsePromise).json()) as {
            correctChoiceId?: unknown;
          };
          const correctChoiceId = requiredString(
            answer.correctChoiceId,
            "correct choice id"
          );
          const correctChoice = choices.find(
            (choice) => choice.id === correctChoiceId
          );
          assert.ok(correctChoice, "The real answer handler must identify a rendered choice.");
          correctDefinitionChoice.set(question, correctChoice.text);
          await clickNext(page);
          continue;
        }

        if (
          await page.getByText("Type the word you heard", { exact: true }).isVisible()
        ) {
          visitedWindows.add("spelling");
          if (await page.getByText("Spelling review", { exact: true }).isVisible()) {
            spellingReviews += 1;
          }
          const inputId = await page.getByLabel("Type the word you heard").getAttribute("id");
          const content = await traffic.waitForContent(
            "spelling-practice",
            (candidate) => `spelling-${String(candidate.attemptId)}` === inputId
          );
          const definition = requiredString(content.definition, "spelling definition");
          const knownAnswer = learnedSpellingAnswers.get(definition);
          const responsePromise = page.waitForResponse(isAnswerResponse);

          await page
            .getByLabel("Type the word you heard")
            .fill(knownAnswer ?? "incorrect");
          await page.getByRole("button", { name: "Check" }).click();
          const feedback = (await (await responsePromise).json()) as {
            correct?: unknown;
            correctAnswer?: unknown;
          };
          if (knownAnswer) {
            assert.equal(feedback.correct, true);
          } else {
            assert.equal(feedback.correct, false);
            learnedSpellingAnswers.set(
              definition,
              requiredString(feedback.correctAnswer, "graded spelling answer")
            );
          }
          await clickNext(page);
          continue;
        }

        if (await page.getByText("Answer recap", { exact: true }).isVisible()) {
          visitedWindows.add("answer-recap");
          answerRecaps += 1;
          const visibleWord = await page.locator("h2.font-display").innerText();
          await traffic.waitForContent(
            "answer-recap",
            (candidate) => candidate.word === visibleWord
          );
          const next = page.getByRole("button", { name: "Next →" });
          await next.waitFor({ state: "visible" });
          await assertEventually(async () => !(await next.isDisabled()));
          await clickAndWaitForScreenChange(page, next);
          continue;
        }

        await page.waitForTimeout(10);
      }

      await page.getByRole("heading", { name: "Lesson complete" }).waitFor();
      assert.equal(page.url(), `${origin}${APP_ROUTE}`);
      assert.equal(introducedWords.size, 20);
      assert.ok(answerRecaps > 0);
      assert.ok(definitionReviews > 0);
      assert.ok(spellingReviews > 0);
      assert.equal(sawWordReplacement, true);
      assert.deepEqual(visitedWindows, new Set([
        "startup",
        "definition-display",
        "definition-fun-fact",
        "multiple-choice",
        "spelling",
        "answer-recap",
        "lesson-complete",
      ]));
      assert.ok(traffic.count(CONTENT_PATH) > 20);
      assert.ok(traffic.count(ANSWER_PATH) > 20);
      assert.ok(traffic.count(SPEECH_PATH) > 0);
      assert.ok(traffic.count(TTS_PATH) > 0);
      assert.equal(traffic.failures(CONTENT_PATH), 0);
      assert.equal(traffic.failures(ANSWER_PATH), 0);
    } finally {
      await browser?.close();
      await stopNextApplication(app);
    }
  }
);

function observeVocabularyTraffic(page: Page) {
  const counts = new Map<string, number>();
  const failures = new Map<string, number>();
  const latestContent = new Map<string, ContentBody>();

  page.on("response", (response) => {
    const path = new URL(response.url()).pathname;
    if (![CONTENT_PATH, ANSWER_PATH, SPEECH_PATH, TTS_PATH].includes(path)) {
      return;
    }
    counts.set(path, (counts.get(path) ?? 0) + 1);
    if ([CONTENT_PATH, ANSWER_PATH, SPEECH_PATH].includes(path) && response.status() >= 400) {
      failures.set(path, (failures.get(path) ?? 0) + 1);
    }
    if (path === CONTENT_PATH && response.ok()) {
      void response.json().then((body: ContentBody) => {
        latestContent.set(body.contentType, body);
      });
    }
  });

  return {
    count: (path: string) => counts.get(path) ?? 0,
    snapshot: () => Object.fromEntries(counts),
    failures: (path: string) => failures.get(path) ?? 0,
    async waitForContent(
      contentType: string,
      matches: (body: ContentBody) => boolean = () => true
    ): Promise<ContentBody> {
      await assertEventually(async () => {
        const body = latestContent.get(contentType);
        return body !== undefined && matches(body);
      });
      return latestContent.get(contentType)!;
    },
  };
}

function isAnswerResponse(response: { url(): string; request(): { method(): string } }) {
  return (
    new URL(response.url()).pathname === ANSWER_PATH &&
    response.request().method() === "POST"
  );
}

async function isVisible(
  page: Page,
  role: "heading",
  name: string
): Promise<boolean> {
  return page.getByRole(role, { name }).isVisible();
}

async function clickNext(page: Page): Promise<void> {
  const next = page.getByRole("button", { name: "Next →" });
  await next.waitFor({ state: "visible" });
  await clickAndWaitForScreenChange(page, next);
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

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    assert.fail(`Expected ${label} to be a string.`);
  }
  return value;
}

function requiredChoices(value: unknown): Choice[] {
  assert.ok(Array.isArray(value));
  return value.map((choice) => {
    assert.equal(typeof choice, "object");
    assert.ok(choice !== null);
    const record = choice as Record<string, unknown>;
    return {
      id: requiredString(record.id, "choice id"),
      text: requiredString(record.text, "choice text"),
    };
  });
}

async function assertEventually(
  assertion: () => Promise<boolean>,
  timeoutMs = 10_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await assertion())) {
    if (Date.now() >= deadline) {
      assert.fail("Timed out waiting for the running application state.");
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
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
