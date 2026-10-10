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
3. Click the **G4 Test Wright** flask in the Activity Bar — Test Wright opens in a tab. (With a tab open, the flask shows the side bar, whose **Open Test Wright** button opens more tabs.)
4. Press **Discover Bots**, drag bots into the **Testing Plan**, and press **Run**.

👉 **New to Test Wright?** The **[Run Your Bots](resources.docs/run-your-bots/README.md)** learning path walks you through it, click by click.

---

## Documentation

* 📗 **[Run Your Bots](resources.docs/run-your-bots/README.md)** — discover bots, build and save plans, run them, read the results, open Allure reports, and schedule runs.
* 🧩 **[Webview components](resources.components/README.md)** — for contributors: how the pages are built from `g4-*` components.

---

## Key Capabilities

* **Bots are tests** — `.json`, `.g4`, and `.g4bot` files under `bots/` are discovered as tests; subfolders become suites. Tags come from each bot's `reference.tags`.
* **Drag-and-drop plans** — drag bots or whole suites into the plan, reorder them, tick the ones to run, and save the plan to the repository or a file.
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
│   ├── run.json                   # run summary: settings, tally, one entry per bot
│   ├── a.g4rpt                    # G4 automation report per bot (Base64 JSON)
│   └── smoke.tagged.g4rpt
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
├── resources.docs/             # learning paths
├── resources.fonts/
└── src/
    ├── clients/                # G4 engine HTTP client
    ├── commands/               # VS Code commands (CommandBase pattern)
    ├── constants/
    ├── extensions/             # utilities, webview page and component helpers
    ├── logging/
    ├── models/
    ├── providers/              # Test Wright panel, run report tabs
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
* A compatible **G4 Engine backend** — local (via the [G4 sandbox](https://github.com/g4-api/g4-sandbox)) or remote
* Node.js — only for extension development/build
