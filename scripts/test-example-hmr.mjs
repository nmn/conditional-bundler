#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { cleanExampleCaches } from "./clean-example-caches.mjs";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const defaultTimeout = Number(process.env.HMR_TEST_TIMEOUT ?? 45_000);

const scenarios = [
  {
    name: "react-rsc-basic",
    initialHeading: "Server components with a conditional client branch.",
    initialCount: 2,
    server: {
      file: "src/App.jsx",
      text: {
        find: "Server components with a conditional client branch.",
        target: heading,
      },
      style: {
        find: "<h1>",
        replace: (radius) => `<h1 style={{ borderRadius: "${radius}px" }}>`,
        target: heading,
      },
    },
    client: {
      file: "src/Counter.jsx",
      text: {
        find: "Increment",
        target: basicCounterButton,
      },
      style: {
        find: `<button type="button" onClick={() => setCount((value) => value + 1)}>`,
        replace: (radius) =>
          `<button type="button" style={{ borderRadius: "${radius}px" }} onClick={() => setCount((value) => value + 1)}>`,
        target: basicCounterButton,
      },
    },
    interaction: {
      button: basicCounterButton,
      value: (page) =>
        page.locator(
          'section[aria-label="Client component examples"] .counter strong',
        ),
    },
  },
  commerceScenario("react-rsc-commerce", "plain"),
  commerceScenario("react-rsc-commerce-stylex", "stylex"),
  commerceScenario("react-rsc-commerce-tailwind", "tailwind"),
  spaScenario("react-spa-stylex", "stylex"),
  spaScenario("react-spa-tailwind", "tailwind"),
];

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.list) {
    for (const scenario of scenarios) {
      console.log(scenario.name);
    }
    return;
  }

  await assertEveryExampleHasAScenario();

  const selectedScenarios =
    options.examples.length === 0
      ? scenarios
      : options.examples.map((name) => {
          const scenario = scenarios.find((item) => item.name === name);
          if (!scenario) {
            throw new Error(
              `Unknown example "${name}". Use --list to see valid names.`,
            );
          }
          return scenario;
        });

  let playwright;
  try {
    playwright = await import("playwright");
  } catch (error) {
    throw new Error(
      "Playwright is not installed. Run `pnpm install` and try again.",
      { cause: error },
    );
  }

  const browserType = playwright[options.browser];
  if (!browserType || typeof browserType.launch !== "function") {
    throw new Error(
      `Unsupported browser "${options.browser}". Use chromium, firefox, or webkit.`,
    );
  }

  let browser;
  try {
    browser = await browserType.launch({
      headless: !options.headed,
      slowMo: options.slowMo,
    });
  } catch (error) {
    throw new Error(
      `Could not launch Playwright ${options.browser}. Run \`pnpm exec playwright install ${options.browser}\` first.`,
      { cause: error },
    );
  }

  const failures = [];
  const startedAt = Date.now();

  try {
    for (const [index, scenario] of selectedScenarios.entries()) {
      const started = Date.now();
      console.log(
        `[${index + 1}/${selectedScenarios.length}] ${scenario.name}`,
      );
      try {
        await cleanExampleCaches([scenario.name]);
        process.stdout.write("  development HMR ... ");
        await runDevelopmentScenario(browser, scenario, index);
        console.log("passed");
        process.stdout.write("  production build and runtime ... ");
        await runProductionScenario(browser, scenario);
        console.log(`passed (${formatDuration(Date.now() - started)} total)`);
      } catch (error) {
        console.log(`FAILED (${formatDuration(Date.now() - started)} total)`);
        failures.push({ name: scenario.name, error });
        console.error(indent(formatError(error), "  "));
        if (!options.keepGoing) break;
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} example scenario${failures.length === 1 ? "" : "s"} failed.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `\nAll ${selectedScenarios.length} development HMR and production scenarios passed (${formatDuration(Date.now() - startedAt)}).`,
    );
  }
}

async function runDevelopmentScenario(
  browserInstance,
  scenario,
  scenarioIndex,
) {
  const exampleDir = path.join(rootDir, "examples", scenario.name);
  const editor = new SourceEditor(exampleDir);
  const server = new ExampleServer(
    exampleDir,
    scenario.name,
    "dev",
    "development",
  );
  const context = await browserInstance.newContext({
    viewport: { width: 1280, height: 900 },
  });
  context.setDefaultTimeout(defaultTimeout);

  const page = await context.newPage();
  const browserErrors = collectBrowserErrors(page);

  let primaryError;
  try {
    const baseUrl = await server.start();
    const response = await page.goto(baseUrl, {
      waitUntil: "domcontentloaded",
    });
    assert(
      response?.ok(),
      `Initial request failed with ${response?.status()}.`,
    );

    await expectVisibleText(
      scenario.server.text.target(page),
      scenario.initialHeading,
      "initial UI",
    );
    await page.locator("main").first().waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    assertNoBrowserErrors(browserErrors, "initial render");

    const pageIdentity = `hmr-${process.pid}-${Date.now()}-${scenarioIndex}`;
    await page.evaluate((identity) => {
      globalThis.__CONDITIONAL_BUNDLER_HMR_TEST_PAGE__ = identity;
    }, pageIdentity);

    await expectCount(page, scenario, scenario.initialCount, "initial count");
    await scenario.interaction.button(page).click();
    await expectCount(
      page,
      scenario,
      scenario.initialCount + 1,
      "initial client interaction",
    );

    const nonce = Array.from({ length: 12 }, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26)),
    ).join("");
    const serverMarker = `HMR server ${nonce}`;
    await editor.replace(
      scenario.server.file,
      scenario.server.text.find,
      serverMarker,
    );
    await expectVisibleText(
      scenario.server.text.target(page),
      serverMarker,
      "server-component text HMR",
    );
    await expectHmrState(
      page,
      pageIdentity,
      scenario,
      scenario.initialCount + 1,
      browserErrors,
      "server-component text HMR",
    );

    const serverRadius = 1_000 + Math.floor(Math.random() * 900_000);
    await expectStyleNot(
      scenario.server.style.target(page),
      "border-top-left-radius",
      `${serverRadius}px`,
      "new server-component style",
    );
    await editor.replace(
      scenario.server.file,
      scenario.server.style.find,
      scenario.server.style.replace(serverRadius),
    );
    await expectStyle(
      scenario.server.style.target(page),
      "border-top-left-radius",
      `${serverRadius}px`,
      "server-component style HMR",
    );
    await expectHmrState(
      page,
      pageIdentity,
      scenario,
      scenario.initialCount + 1,
      browserErrors,
      "server-component style HMR",
    );

    const clientMarker = `HMR client ${nonce}`;
    await editor.replace(
      scenario.client.file,
      scenario.client.text.find,
      clientMarker,
    );
    await expectVisibleText(
      scenario.client.text.target(page),
      clientMarker,
      "client-component text HMR",
    );
    await expectHmrState(
      page,
      pageIdentity,
      scenario,
      scenario.initialCount + 1,
      browserErrors,
      "client-component text HMR",
    );

    const clientRadius = serverRadius + 2;
    await expectStyleNot(
      scenario.client.style.target(page),
      "border-top-left-radius",
      `${clientRadius}px`,
      "new client-component style",
    );
    await editor.replace(
      scenario.client.file,
      scenario.client.style.find,
      scenario.client.style.replace(clientRadius),
    );
    await expectStyle(
      scenario.client.style.target(page),
      "border-top-left-radius",
      `${clientRadius}px`,
      "client-component style HMR",
    );
    await expectHmrState(
      page,
      pageIdentity,
      scenario,
      scenario.initialCount + 1,
      browserErrors,
      "client-component style HMR",
    );

    await scenario.interaction.button(page).click();
    await expectCount(
      page,
      scenario,
      scenario.initialCount + 2,
      "client interaction after HMR",
    );
    await page.waitForTimeout(250);
    assertNoBrowserErrors(browserErrors, "completed HMR scenario");
  } catch (error) {
    primaryError = error;
  }

  const cleanupErrors = [];
  await context.close().catch((error) => cleanupErrors.push(error));
  await server.stop().catch((error) => cleanupErrors.push(error));
  await editor.restoreAll().catch((error) => cleanupErrors.push(error));

  if (primaryError) {
    const serverOutput = server.output.trim();
    const suffix = [
      serverOutput && `Dev server output:\n${serverOutput}`,
      ...cleanupErrors.map((error) => `Cleanup error:\n${formatError(error)}`),
    ]
      .filter(Boolean)
      .join("\n\n");
    throw new Error(
      `${formatError(primaryError)}${suffix ? `\n\n${suffix}` : ""}`,
      { cause: primaryError },
    );
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Failed to clean up HMR scenario.");
  }
}

async function runProductionScenario(browserInstance, scenario) {
  const exampleDir = path.join(rootDir, "examples", scenario.name);
  await buildExample(exampleDir, scenario.name);

  const server = new ExampleServer(
    exampleDir,
    scenario.name,
    "start",
    "production",
  );
  const context = await browserInstance.newContext({
    viewport: { width: 1280, height: 900 },
  });
  context.setDefaultTimeout(defaultTimeout);
  const page = await context.newPage();
  const browserErrors = collectBrowserErrors(page);

  let primaryError;
  try {
    const baseUrl = await server.start();
    const response = await page.goto(baseUrl, {
      waitUntil: "domcontentloaded",
    });
    assert(
      response?.ok(),
      `Production request failed with ${response?.status()}.`,
    );
    await expectVisibleText(
      scenario.server.text.target(page),
      scenario.initialHeading,
      "production initial UI",
    );
    await page.locator("main").first().waitFor({ state: "visible" });
    await page.waitForTimeout(400);
    assertNoBrowserErrors(browserErrors, "production initial render");

    await expectCount(
      page,
      scenario,
      scenario.initialCount,
      "production initial count",
    );
    await scenario.interaction.button(page).click();
    await expectCount(
      page,
      scenario,
      scenario.initialCount + 1,
      "production client interaction",
    );
    await page.waitForTimeout(250);
    assertNoBrowserErrors(browserErrors, "production client interaction");
  } catch (error) {
    primaryError = error;
  }

  const cleanupErrors = [];
  await context.close().catch((error) => cleanupErrors.push(error));
  await server.stop().catch((error) => cleanupErrors.push(error));

  if (primaryError) {
    const serverOutput = server.output.trim();
    const suffix = [
      serverOutput && `Production server output:\n${serverOutput}`,
      ...cleanupErrors.map((error) => `Cleanup error:\n${formatError(error)}`),
    ]
      .filter(Boolean)
      .join("\n\n");
    throw new Error(
      `${formatError(primaryError)}${suffix ? `\n\n${suffix}` : ""}`,
      { cause: primaryError },
    );
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      "Failed to clean up production scenario.",
    );
  }
}

async function expectHmrState(
  page,
  pageIdentity,
  scenario,
  expectedCount,
  errors,
  label,
) {
  const currentIdentity = await page.evaluate(
    () => globalThis.__CONDITIONAL_BUNDLER_HMR_TEST_PAGE__,
  );
  assert(
    currentIdentity === pageIdentity,
    `${label} reloaded the page instead of applying HMR.`,
  );
  await expectCount(page, scenario, expectedCount, `${label} state`);
  await page.waitForTimeout(250);
  assertNoBrowserErrors(errors, label);
}

async function expectCount(page, scenario, expected, label) {
  await waitUntil(label, async () => {
    const text = await scenario.interaction.value(page).textContent();
    const numbers = text?.match(/-?\d+/g) ?? [];
    const actual = Number(numbers.at(-1));
    return actual === expected
      ? true
      : `expected ${expected}, received ${JSON.stringify(text)}`;
  });
}

async function expectVisibleText(locator, expected, label) {
  await waitUntil(label, async () => {
    if (!(await locator.isVisible().catch(() => false))) {
      return "target was not visible";
    }
    const actual = await locator.textContent();
    return actual?.includes(expected)
      ? true
      : `expected text ${JSON.stringify(expected)}, received ${JSON.stringify(
          actual,
        )}`;
  });
}

async function expectStyleNot(locator, property, unexpected, label) {
  await locator.waitFor({ state: "visible" });
  const actual = await readStyle(locator, property);
  assert(
    actual !== unexpected,
    `${label} was already applied before its source edit (${property}: ${actual}).`,
  );
}

async function expectStyle(locator, property, expected, label) {
  await waitUntil(label, async () => {
    if (!(await locator.isVisible().catch(() => false))) {
      return "target was not visible";
    }
    const actual = await readStyle(locator, property);
    return actual === expected
      ? true
      : `expected ${property}: ${expected}, received ${actual}`;
  });
}

function readStyle(locator, property) {
  return locator.evaluate(
    (element, cssProperty) =>
      globalThis.getComputedStyle(element).getPropertyValue(cssProperty),
    property,
  );
}

async function waitUntil(label, probe) {
  const deadline = Date.now() + defaultTimeout;
  let detail = "condition was not met";
  while (Date.now() < deadline) {
    try {
      const result = await probe();
      if (result === true) return;
      if (typeof result === "string") detail = result;
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error);
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${detail}`);
}

function assertNoBrowserErrors(errors, label) {
  assert(
    errors.length === 0,
    `Browser errors during ${label}:\n${errors.join("\n")}`,
  );
}

function collectBrowserErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location();
    errors.push(
      `console.error: ${message.text()}${
        location.url ? ` (${location.url}:${location.lineNumber})` : ""
      }`,
    );
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.stack ?? error.message}`);
  });
  page.on("response", (response) => {
    const resourceType = response.request().resourceType();
    if (
      response.status() >= 400 &&
      ["document", "script", "stylesheet"].includes(resourceType)
    ) {
      errors.push(
        `${resourceType} request failed: ${response.status()} ${response.url()}`,
      );
    }
  });
  return errors;
}

class SourceEditor {
  #root;
  #files = new Map();

  constructor(exampleDir) {
    this.#root = exampleDir;
  }

  async replace(relativePath, find, replacement) {
    const absolutePath = path.join(this.#root, relativePath);
    let record = this.#files.get(absolutePath);
    if (!record) {
      const original = await fs.readFile(absolutePath, "utf8");
      record = { original, lastWritten: original };
      this.#files.set(absolutePath, record);
    }

    const occurrences = record.lastWritten.split(find).length - 1;
    assert(
      occurrences === 1,
      `${relativePath}: expected one occurrence of ${JSON.stringify(
        find,
      )}, found ${occurrences}.`,
    );
    record.lastWritten = record.lastWritten.replace(find, replacement);
    await fs.writeFile(absolutePath, record.lastWritten, "utf8");
  }

  async restoreAll() {
    const errors = [];
    for (const [absolutePath, record] of [...this.#files].reverse()) {
      try {
        const current = await fs.readFile(absolutePath, "utf8");
        if (current !== record.lastWritten) {
          throw new Error(
            `Refusing to restore ${path.relative(
              rootDir,
              absolutePath,
            )} because it changed outside the HMR test.`,
          );
        }
        await fs.writeFile(absolutePath, record.original, "utf8");
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, "Could not restore edited sources.");
    }
  }
}

async function buildExample(exampleDir, name) {
  const child = spawn("corepack", ["pnpm", "run", "build"], {
    cwd: exampleDir,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      BUNDLER_MODE: "production",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const append = (chunk) => {
    output += chunk.toString();
    if (output.length > 200_000) output = output.slice(-200_000);
    if (process.env.HMR_TEST_DEBUG === "1") process.stdout.write(chunk);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);

  const completion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  const timeout = Number(process.env.HMR_BUILD_TIMEOUT ?? 120_000);
  let timeoutHandle;
  const outcome = await Promise.race([
    completion,
    new Promise((resolve) => {
      timeoutHandle = setTimeout(() => resolve({ timedOut: true }), timeout);
    }),
  ]).finally(() => clearTimeout(timeoutHandle));

  if (outcome.timedOut) {
    signalProcess(child, "SIGTERM");
    if (!(await waitForExit(completion, 2_000))) {
      signalProcess(child, "SIGKILL");
    }
    await completion.catch(() => {});
    throw new Error(
      `${name} production build timed out after ${timeout}ms.\n${output}`,
    );
  }
  if (outcome.code !== 0) {
    throw new Error(
      `${name} production build exited with code ${outcome.code}${
        outcome.signal ? ` (${outcome.signal})` : ""
      }.\n${output}`,
    );
  }
}

class ExampleServer {
  #exampleDir;
  #name;
  #script;
  #mode;
  #child;
  #output = "";
  #exit;

  constructor(exampleDir, name, script, mode) {
    this.#exampleDir = exampleDir;
    this.#name = name;
    this.#script = script;
    this.#mode = mode;
  }

  get output() {
    return this.#output;
  }

  async start() {
    const port = await getFreePort();
    this.#child = spawn("corepack", ["pnpm", "run", this.#script], {
      cwd: this.#exampleDir,
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        BUNDLER_MODE: this.#mode,
        NODE_ENV: this.#mode,
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.#exit = new Promise((resolve) => {
      this.#child.once("exit", (code, signal) => resolve({ code, signal }));
    });
    const append = (chunk) => {
      this.#output += chunk.toString();
      if (this.#output.length > 200_000) {
        this.#output = this.#output.slice(-200_000);
      }
      if (process.env.HMR_TEST_DEBUG === "1") process.stdout.write(chunk);
    };
    this.#child.stdout.on("data", append);
    this.#child.stderr.on("data", append);

    const baseUrl = `http://127.0.0.1:${port}/`;
    await waitUntil(`${this.#name} ${this.#mode} server`, async () => {
      if (this.#child.exitCode !== null) {
        throw new Error(
          `${this.#mode} server exited with code ${this.#child.exitCode}.\n${this.#output}`,
        );
      }
      try {
        const response = await fetch(baseUrl);
        return response.ok ? true : `HTTP ${response.status}`;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    return baseUrl;
  }

  async stop() {
    if (!this.#child || this.#child.exitCode !== null) return;
    signalProcess(this.#child, "SIGINT");
    if (await waitForExit(this.#exit, 4_000)) return;
    signalProcess(this.#child, "SIGTERM");
    if (await waitForExit(this.#exit, 2_000)) return;
    signalProcess(this.#child, "SIGKILL");
    await this.#exit;
  }
}

function commerceScenario(name, styling) {
  const serverStyle =
    styling === "stylex"
      ? {
          find: "  heroTitle: {\n    fontSize:",
          replace: (radius) =>
            `  heroTitle: {\n    borderRadius: ${radius},\n    fontSize:`,
        }
      : styling === "tailwind"
        ? {
            find: `className="my-2 text-[clamp(3rem,7vw,7.4rem)] leading-[.88] tracking-[-.06em]"`,
            replace: (radius) =>
              `className="my-2 rounded-[${radius}px] text-[clamp(3rem,7vw,7.4rem)] leading-[.88] tracking-[-.06em]"`,
          }
        : {
            find: "<h1>",
            replace: (radius) => `<h1 style={{ borderRadius: "${radius}px" }}>`,
          };
  const clientStyle =
    styling === "stylex"
      ? {
          find: "  button: {\n    backgroundColor:",
          replace: (radius) =>
            `  button: {\n    borderRadius: ${radius},\n    backgroundColor:`,
        }
      : styling === "tailwind"
        ? {
            find: `className="cursor-pointer border border-ink bg-porcelain px-3 py-2 text-red"`,
            replace: (radius) =>
              `className="cursor-pointer rounded-[${radius}px] border border-ink bg-porcelain px-3 py-2 text-red"`,
          }
        : {
            find: `aria-label="Reset counter"\n          onClick={() => setCount(0)}`,
            replace: (radius) =>
              `aria-label="Reset counter"\n          style={{ borderRadius: "${radius}px" }}\n          onClick={() => setCount(0)}`,
          };

  return {
    name,
    initialHeading:
      "Housewares, pantry goods, and coffee with a point of view.",
    initialCount: 0,
    server: {
      file: "src/routes/Home.jsx",
      text: {
        find: "Housewares, pantry goods, and coffee with a point of view.",
        target: heading,
      },
      style: {
        ...serverStyle,
        target: heading,
      },
    },
    client: {
      file: "src/client/HomeCounter.jsx",
      text: {
        find: "          Reset\n",
        target: resetCounterButton,
      },
      style: {
        ...clientStyle,
        target: resetCounterButton,
      },
    },
    interaction: {
      button: increaseCounterButton,
      value: (page) =>
        resetCounterButton(page).locator("xpath=../..").locator("strong"),
    },
  };
}

function spaScenario(name, styling) {
  const stylex = styling === "stylex";
  const brand = stylex ? "Greenline Ops" : "Signal House";
  const clientLabel = stylex ? "Refreshes:" : "Refresh ";

  return {
    name,
    initialHeading: brand,
    initialCount: 0,
    server: {
      file: "src/App.jsx",
      text: {
        find: brand,
        target: spaBrand,
      },
      style: {
        find: stylex
          ? "  brand: {\n    color:"
          : `className="text-2xl tracking-tight text-pop"`,
        replace: stylex
          ? (radius) => `  brand: {\n    borderRadius: ${radius},\n    color:`
          : (radius) =>
              `className="rounded-[${radius}px] text-2xl tracking-tight text-pop"`,
        target: spaBrand,
      },
    },
    client: {
      file: "src/routes/Dashboard.jsx",
      text: {
        find: clientLabel,
        target: dashboardButton,
      },
      style: {
        find: stylex
          ? "  button: {\n    backgroundColor:"
          : `className="cursor-pointer border-0 bg-pop px-3.5 py-2.5 text-night"`,
        replace: stylex
          ? (radius) =>
              `  button: {\n    borderRadius: ${radius},\n    backgroundColor:`
          : (radius) =>
              `className="cursor-pointer rounded-[${radius}px] border-0 bg-pop px-3.5 py-2.5 text-night"`,
        target: dashboardButton,
      },
    },
    interaction: {
      button: dashboardButton,
      value: dashboardButton,
    },
  };
}

function heading(page) {
  return page.getByRole("heading", { level: 1 }).first();
}

function basicCounterButton(page) {
  return page
    .locator('section[aria-label="Client component examples"] button')
    .first();
}

function resetCounterButton(page) {
  return page.getByRole("button", { name: "Reset counter" });
}

function increaseCounterButton(page) {
  return page.getByRole("button", { name: "Increase counter" });
}

function spaBrand(page) {
  return page.locator("aside strong").first();
}

function dashboardButton(page) {
  return page.locator("header button").first();
}

async function assertEveryExampleHasAScenario() {
  const examplesDir = path.join(rootDir, "examples");
  const entries = await fs.readdir(examplesDir, { withFileTypes: true });
  const runnable = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const packagePath = path.join(examplesDir, entry.name, "package.json");
    try {
      const packageJson = JSON.parse(await fs.readFile(packagePath, "utf8"));
      if (packageJson.scripts?.dev) runnable.push(entry.name);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const configured = scenarios.map((scenario) => scenario.name);
  const missing = runnable.filter((name) => !configured.includes(name));
  const stale = configured.filter((name) => !runnable.includes(name));
  assert(
    missing.length === 0 && stale.length === 0,
    [
      missing.length && `Missing HMR scenarios: ${missing.join(", ")}`,
      stale.length && `Scenarios without a dev example: ${stale.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function parseArgs(args) {
  const parsed = {
    browser: process.env.HMR_BROWSER ?? "chromium",
    examples: [],
    headed: process.env.HMR_HEADED === "1",
    help: false,
    keepGoing: false,
    list: false,
    slowMo: Number(process.env.HMR_SLOW_MO ?? 0),
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") {
      continue;
    } else if (argument === "--browser") {
      parsed.browser = requiredValue(args, ++index, argument);
    } else if (argument.startsWith("--browser=")) {
      parsed.browser = argument.slice("--browser=".length);
    } else if (argument === "--example") {
      parsed.examples.push(requiredValue(args, ++index, argument));
    } else if (argument.startsWith("--example=")) {
      parsed.examples.push(argument.slice("--example=".length));
    } else if (argument === "--headed") {
      parsed.headed = true;
    } else if (argument === "--keep-going") {
      parsed.keepGoing = true;
    } else if (argument === "--list") {
      parsed.list = true;
    } else if (argument === "--slow-mo") {
      parsed.slowMo = Number(requiredValue(args, ++index, argument));
    } else if (argument === "--help" || argument === "-h") {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument "${argument}". Use --help for usage.`);
    }
  }
  return parsed;
}

function requiredValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: pnpm test:hmr [options]

Clears each example's cache, verifies development HMR for server/app-shell text
and styles, client-component text and styles, state preservation, and console
errors, then builds and verifies the production server and client interaction.

Options:
  --example <name>   Run one example. Repeat to run several.
  --browser <name>   chromium (default), firefox, or webkit.
  --headed           Show the browser window.
  --slow-mo <ms>     Delay Playwright actions for debugging.
  --keep-going       Continue after a failed example.
  --list             Print configured examples.
  -h, --help         Show this help.

Environment:
  HMR_TEST_TIMEOUT   Per-operation timeout in milliseconds (default: 45000).
  HMR_BUILD_TIMEOUT  Per-example build timeout in milliseconds (default: 120000).
  HMR_TEST_DEBUG=1   Stream build and server output while the test runs.
  HMR_BROWSER        Default browser when --browser is omitted.
  HMR_HEADED=1       Run headed when --headed is omitted.`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function signalProcess(child, signal) {
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function waitForExit(exit, timeout) {
  let timeoutHandle;
  return Promise.race([
    exit.then(() => true),
    new Promise((resolve) => {
      timeoutHandle = setTimeout(() => resolve(false), timeout);
    }),
  ]).finally(() => clearTimeout(timeoutHandle));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function formatError(error) {
  if (error instanceof AggregateError) {
    return [error.message, ...error.errors.map(formatError)].join("\n");
  }
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}

function formatDuration(milliseconds) {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

function indent(value, prefix) {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

await main();
