# G4 Studio Test Wright – Run Your G4 Bots as Tests in VS Code

**Discover, plan, run, and report your G4 bots — right inside VS Code.**

[![Build, Pack & Release G4™ Test Wright](https://github.com/g4-api/g4-test-wright-vscode-extension/actions/workflows/pipeline.yaml/badge.svg)](https://github.com/g4-api/g4-test-wright-vscode-extension/actions/workflows/pipeline.yaml)

[![VS Marketplace](https://img.shields.io/badge/VS%20Marketplace-Install-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=g4-api.g4-test-wright)
![License](https://img.shields.io/github/license/g4-api/g4-test-wright-vscode-extension)

---

## Overview

**G4 Studio Test Wright** turns the bots of a G4 project into a test suite.

Every bot file under the project's `bots/` folder is a **test**, and every subfolder is a **suite**. Test Wright finds them, lets you build a **run plan** by dragging bots and suites into it, runs the plan against the **G4 engine**, and saves every run with its G4 reports and an **Allure** report — no Python, no Java, no extra tools.

It is the VS Code sibling of the desktop [G4 Test Wright](https://github.com/g4-api/g4-test-wright) workbench, and it works side by side with the [G4 Engine](https://github.com/g4-api/g4-vscode-extension) extension.

---

## Get Started

1. Open a G4 project (the folder that holds `manifest.json` and `bots/`) in VS Code.
2. Make sure the G4 engine is running.
3. Click the **G4 Test Wright** icon (**G4** with a check mark) in the Activity Bar — Test Wright opens in a tab. (With a tab open, the icon shows the side bar, whose **Open Test Wright** button opens more tabs.)
4. Press **Discover Bots**, drag bots into the **Testing Plan**, and press **Run**.

👉 **New to Test Wright?** Run **G4 Test Wright: Add Practice Bots** from the Command Palette, then follow the **[Run Your Bots](resources.docs/run-your-bots/README.md)** learning path — it walks you through every part, click by click, with a picture for each step.

---

## Documentation

The learning paths start at **[Test Wright Learning Paths](resources.docs/test-wright-learning.md)**, the index of every path:

* 📗 **[Run Your Bots](resources.docs/run-your-bots/README.md)** — 12 short modules with practice bots: discover bots, build and save plans, pick an environment, run, read the results, open Allure reports, schedule runs, and make your bots better tests.
* 🧩 **[Webview components](resources.components/README.md)** — for contributors: how the pages are built from `g4-*` components.

### The Documentation view

The G4 Test Wright side bar has a **Documentation** view under **Test Wright**. It lists the learning paths shipped with the extension the way a file explorer does: folders first, then files, A-Z within each group — one folder per path (for example **Run Your Bots**), then the **Test Wright Learning Paths** index. Select a document to open it in the Markdown preview, where its links and images work. The refresh button in the view title reads the folder again.

---

## Key Capabilities

* **Bots are tests** — `.json`, `.g4`, and `.g4bot` files under `bots/` are discovered as tests; subfolders become suites. Tags come from each bot's `reference.tags`.
* **Drag-and-drop plans** — drag bots or whole suites into the plan, reorder them, switch on the ones to run, and save the plan to the repository or a file. A bot can appear more than once; every plan item runs on its own, in its position.
* **Data-driven iterations** — run the whole suite once per iteration, with each plan item's own values for its `{{$ columns.Name }}` placeholders. See [Iterations and data](#iterations-and-data).
* **Runs against the G4 engine** — each bot is sent to the engine with the project's `manifest.json` filling in what the bot leaves out. Run one bot at a time or in parallel, and stop a run at any time.
* **Environments** — pick one of the workspace `environments/` files; it is sent to the engine and set as the bots' default environment.
* **Honest statuses** — a bot **fails** only when an assertion fails. An exception without a failed assertion is a **warning** (Allure *broken*).
* **Run history** — every run is saved under `reports/<run>/` with a `run.json` summary and one G4 report per bot. Open any run, drill into a bot's report, or drag the run back into the plan to rerun it.
* **Allure 3 built in** — runs write Allure results to `reports/allure-<run>`, and Test Wright builds the Allure 3 report for one run or merges all of them, in a VS Code tab or your browser. No Java needed.
* **Scheduling** — schedule up to five runs; they fire even when the Test Wright tab is closed.

---

## How It Works

Test Wright is one VS Code webview page backed by services in the extension host:

```none
Test Wright page (webview)          Extension host
──────────────────────────          ─────────────────────────────────────────────
Bots tree, plan, repositories  ⇄   Discovery      bots/ → tests and suites
                                    Request build  bot + manifest + environment
                                    Run service    POST /api/v4/g4/automation/invoke
                                    Evaluator      response → passed/failed/warning/broken
                                    Repositories   reports/<run>/run.json, *.g4rpt
                                    Allure         allure-<run>/results → Allure 3 report
                                    Scheduler      timed runs (kept in the workspace)
```

### What is sent to the engine

For each bot, Test Wright builds the request from the bot file and `manifest.json`:

* The **manifest token always wins** (`authentication.token`).
* For everything else the **bot wins**; manifest values only fill keys the bot leaves out (`authentication`, `driverParameters`, `settings`).
* Client-only manifest sections (`clientLogConfiguration`, `clientLogSettings`, `clientReportSettings`, `recorderSettings`, `queueManagerSettings`) are never sent.
* The selected environment is uploaded to the engine and set as `settings.environmentsSettings.defaultEnvironment`.

The bot file itself is never changed.

### Iterations and data

A bot reads data through `{{$ columns.Name }}` placeholders in its rules. Those placeholders are the
bot's **columns**; a bot without them is **static** and runs unchanged.

* Open **Iterations** (the table icon in the plan header, or a row's data button). The sheet shows
  one row per **iteration** and one column group per plan item that reads data, titled by its plan
  position (`#4 login`), so two items of the same bot keep separate values.
* **Add Iteration** copies the last iteration's values for every item; **Duplicate** copies one
  iteration. The first iteration starts from each bot's own `dataSource` when it has one. **Copy
  values from** fills an item with the values of another item of the same bot.
* Switch **Include** off to skip an iteration for the whole suite.
* Columns follow the bots: a new placeholder adds an empty column, and a removed one drops its column.
  A run with an empty value in an included iteration is refused, and the editor opens at that value.
* Running the plan runs the **whole suite once per included iteration**, in plan order: iteration 1
  runs every item, then iteration 2 runs every item again with the next row. Each item sends its row
  as a one-row data source (Base64), which replaces the bot's own `dataSource` for that run only.
  Static bots run in every iteration. A plan with no iterations runs once, as before.
* **Import** and **Export** read and write the iterations as a JSON data file (`g4-test-wright-data`).
  Items match by key in the same plan, or by position and bot in another plan.
* Results: each execution is recorded with its position, iteration, and values (`run.json`, the run
  report, and Allure parameters); a plan row shows its worst iteration, for example
  `1/2 iterations passed`.

Plans saved with iterations are version 2 plan files; version 1 plans still load.

### How a status is decided

| Status | When |
| --- | --- |
| **Passed** | The engine answered and no assertion failed. |
| **Failed** | At least one assertion evaluated to `false`. |
| **Warning** | No assertion failed, but a plugin raised an exception. Shown as *broken* in Allure. |
| **Broken** | The engine could not be reached, or answered with an error or an empty response. |
| **Canceled** | The run was stopped before the bot finished. |

---

## Run Folder

Every run creates one folder under the project's reports folder, and its Allure files go to a sibling folder with the `allure-` prefix:

```none
reports/
├── 2026-10-08-213643907/          # run name: yyyy-MM-dd-HHmmssfff
│   ├── run.json                   # run summary: settings, tally, one entry per execution
│   ├── a.p1.g4rpt                 # G4 automation report per execution (Base64 JSON)
│   └── smoke.login.p2.i1.g4rpt    # plan position 2, iteration 1
├── allure-2026-10-08-213643907/
│   ├── results/                   # written when Collect is on
│   └── report/                    # built when you open the Allure report
└── allure-merged/                 # built when you open the report of several runs
```

Right-click a `run.json` in the Explorer for **Open Run Report** and **Convert Run to Allure Results**.

### Project folders

When VS Code starts in a G4 project (a `manifest.json` is found), Test Wright creates the folders it writes to if they are missing:

| Folder | Holds |
| --- | --- |
| `<project>/.repositories` | Saved run plans |
| `<project>/reports` | Runs and their Allure folders. The `settings.clientReportSettings.reportsFolder` manifest setting moves it to `<that folder>/reports`. |

The project folder is the workspace folder, or its `src` folder when `manifest.json` is there.

---

## Project Structure

```none
g4-test-wright-vscode-extension/
├── languages/                  # g4log grammar
├── resources.assets/           # icons
├── resources.components/       # webview pages and g4-* components (see its README)
├── resources.docs/             # learning paths (test-wright-learning.md is the index); run-your-bots/practice holds the practice bots
└── src/
    ├── clients/                # G4 engine HTTP client
    ├── commands/               # VS Code commands (CommandBase pattern)
    ├── constants/
    ├── extensions/             # utilities, webview page and component helpers
    ├── logging/
    ├── models/
    ├── providers/              # Test Wright panel, run report tabs, Documentation view
    ├── services/               # discovery, request builder, evaluator, run, repositories, Allure, scheduler
    └── extension.ts
```

### Develop

```bash
npm install
npm run compile      # webpack build into dist/
npm run lint
```

Press **F5** in VS Code to start an Extension Development Host. In that host, **G4 Test Wright: Show Component Gallery (Development)** shows every component on one page.

---

## Requirements

* **Visual Studio Code** `^1.105.0`
* The **G4 Engine Client** extension (`g4-api.g4-engine-client`) — installed automatically with Test Wright, at its latest Marketplace version; it opens bots in the G4 Workflow Editor
* A compatible **G4 Engine backend** — local (via the [G4 sandbox](https://github.com/g4-api/g4-sandbox)) or remote
* Node.js — only for extension development/build
