# G4 Studio Test Wright — Visual Test Plan

A manual (visual) test of every major feature, happy flows only. Each case is run in the
Extension Development Host against a running G4 engine, by clicking and typing in the real UI and
checking a screenshot after every step.

## Environment

| Item | Value |
| --- | --- |
| Workspace | `E:\development\g4\g4-projects\quick-start-v32\src` (opened in the Extension Development Host) |
| Engine | `http://localhost:9944` (from `manifest.json`) |
| Display | 1920×1080, VS Code maximized, dark theme |
| Driver | `SimulatorDriver` only — no browser or desktop driver is needed |

## Test data

All bots live under `bots/visual-tests/` and use `SimulatorDriver` (no token: the manifest token wins).

| Bot | Suite | Tags | Rules | Expected status |
| --- | --- | --- | --- | --- |
| `vt-pass.json` | `visual-tests` | smoke, visual | WaitFlow, Assert (matches), CloseBrowser | Passed |
| `vt-fail.json` | `visual-tests` | regression | WaitFlow, Assert (never matches), CloseBrowser | Failed |
| `vt-warning.json` | `visual-tests` | regression, visual | WaitFlow, InvokeClick on a missing element, CloseBrowser | Warning |
| `vt-environment.json` | `visual-tests` | env | Assert against `VtNamePattern` from environment `VisualStaging` | Failed without the environment on the engine, Passed after it is uploaded |
| `screens/vt-screenshots.g4bot` | `visual-tests/screens` | visual | WaitFlow, 2 × SaveScreenshot (Base64), CloseBrowser | Passed, 2 screenshots in Allure |
| `slow/vt-slow-a.g4`, `slow/vt-slow-b.g4` | `visual-tests/slow` | slow | Wait 8000 ms, CloseBrowser | Passed (about 8 s each) |

Environment file: `environments/VisualStaging.json` with `{ "VtNamePattern": "mock attribute value \\d+" }`.
Before the run, `VisualStaging` is removed from the engine so the first environment check fails.

## Test cases

Each case lists its steps and the expected result. **Pass** means every expected result was seen
on screen (or, where noted, on disk).

### A. Open and discover

| ID | Steps | Expected |
| --- | --- | --- |
| A1 | Close every Test Wright tab. Click the flask in the Activity Bar. | A **G4 Test Wright** tab opens and the side bar collapses. |
| A2 | Look at the header. | Bots folder = project `bots`, Environment = `(none)`, engine dot green, status **Ready**/**Idle**. |
| A3 | Press **Discover Bots**. | Tree shows suites `nested`, `visual-tests` (with `screens`, `slow`) and root bots; **10 discovered**; folder and file icons; indent guides. |
| A4 | Type `vt-` in the filter. | Only the 7 visual-test bots are visible; **visible** = 7. Clear the filter. |
| A5 | Open the tag filter, tick `regression`. | Only `vt-fail` and `vt-warning` are visible; the trigger shows the selection. Clear the tags. |
| A6 | Collapse all, expand all (tree header buttons). | All suites close, then open. |

### B. Tree interactions

| ID | Steps | Expected |
| --- | --- | --- |
| B1 | Click `vt-pass`; press ↓, ←, ←, →. | Selection moves down, jumps to the parent suite, collapses it, expands it. |
| B2 | Select `vt-pass`, press **Enter**. | `vt-pass` is added to the plan (1 item). |
| B3 | Hover the `slow` suite, click **+**. | Both slow bots are added (3 items). |
| B4 | Drag `vt-fail` from the tree onto the plan. | `vt-fail` is added where it was dropped. |
| B5 | Double-click `vt-warning` in the tree. | `vt-warning.json` opens in an editor. Return to Test Wright. |

### C. Plan editing and plan files

| ID | Steps | Expected |
| --- | --- | --- |
| C1 | **Clear plan**, confirm. Drag the `visual-tests` suite onto the plan. | Plan holds the 7 visual-test bots; counters 7 items / 7 checked. |
| C2 | Drag the last row to the top. | Order changes. |
| C3 | Untick `vt-environment`; remove `vt-slow-b` with **×**. | 6 items / 5 checked. |
| C4 | **Save plan to repository**, name `visual-smoke`. | `visual-smoke` appears in **Test Plans Repository**. |
| C5 | **Clear plan**, then double-click `visual-smoke` in the repository. | The saved plan is restored (6 items / 5 checked). |
| C6 | **Export plan to file** to `exports/visual-export.json` under the project folder (save dialog). Not under `bots/`, where it would be discovered as a broken bot. | File written; console logs the export. |
| C7 | **Clear plan**, **Import plan from file**, pick `visual-export.json`. | The plan is restored again. |

### D. Run

| ID | Steps | Expected |
| --- | --- | --- |
| D1 | Environment `(none)`, Parallel Tests off. Plan = pass, fail, warning, screenshots. Press **Run**. | Rows go Queued → Running → **Passed / Failed / Warning / Passed**; status **Running** then back; tree shows ✓ ✗ ⚠ ✓ icons. |
| D2 | Hover the failed row. | Tooltip names the assertion: expected `^never-matches$`. |
| D3 | Open the console (status bar). | Run start, each bot, and the run folder are logged. |
| D4 | Plan = `vt-environment` only, Environment `(none)`. **Run**. | **Failed** (`expected '^$'`). |
| D5 | Pick Environment **VisualStaging**. **Run** again. | **Passed**; console shows the environment was synced. |
| D6 | Plan = both slow bots, Parallel Tests **on**, **Run**. | Both rows run at the same time; the run takes about 8 s, not 16 s. |
| D7 | Parallel Tests off, **Run**, press **Stop** while the first slow bot runs. | Run stops; unfinished rows become **Canceled**; a run folder is still written. |

### E. Reports

| ID | Steps | Expected |
| --- | --- | --- |
| E1 | Open **Test Reports Repository**. | Runs from section D listed newest first with passed/failed/warning counts. |
| E2 | Click the D1 run. | Run Report modal: status, tally, one row per bot with messages. |
| E3 | Click the `vt-fail` row. | G4 automation report tab opens for that bot. |
| E4 | In the modal, **Open in Tab**. | Run report opens in its own tab. |
| E5 | **Reveal Folder** / **Open run.json**. | Folder shown in Explorer / `run.json` opens. Folder layout: `<run>/` holds `run.json` + `.g4rpt`; `allure-<run>/results` beside it. |
| E6 | Drag the D1 run onto the plan (Append off). | Plan is replaced by the run's 4 bots after confirmation. |
| E7 | In the VS Code Explorer, right-click a `run.json` → **Open Run Report**. | Run report tab opens. |

### F. Allure

| ID | Steps | Expected |
| --- | --- | --- |
| F1 | In the D1 Run Report, **Open Allure**. | Allure 3 report opens in a VS Code tab with 4 tests: 2 passed, 1 failed, 1 broken. |
| F2 | Open `vt-screenshots` in Allure. | Steps without rule JSON; the 2 SaveScreenshot steps each show an image. |
| F3 | Open `vt-fail` in Allure. | Failed step with the assertion attachment. |
| F4 | **Allure Reports** → select the `reports` folder → **Open** with **Browser** on. | Merged report of all runs opens in the external browser. |
| F5 | On a run, **Convert to Allure**. | Notice "Allure results written (N result(s))". |

### G. Schedule and multiple tabs

| ID | Steps | Expected |
| --- | --- | --- |
| G1 | Plan = `vt-pass`. Pick a time 2 minutes ahead; **Schedule Run**. | Schedule listed with time, 1 item, environment. |
| G2 | Type label `Visual nightly` on the schedule. | Label kept. |
| G3 | Schedule a second run and cancel it with **×**. | It disappears. |
| G4 | Wait for G1's time. | Run starts on its own; a run labeled `Visual nightly` appears in the reports. |
| G5 | With a Test Wright tab open, click the flask; in the side bar click **Open Test Wright**. | A second tab **G4 Test Wright (2)** opens; side bar stays open. |
| G6 | Run `vt-slow-a` in tab 2. | Tab 2's console shows the run; tab 1's console does not. |

## Reporting

Every case gets **Pass**, **Fail** (with a screenshot and a bug entry), or **Blocked** (a
previous failure prevents it). Bugs are logged, not fixed, during the run.

Findings already known from preparing the test data:

- **BUG-1** — The environment upload fails (HTTP 400) for environment names with characters
  other than letters, digits, and `_` (for example `visual-staging`), and for non-string values.
  Test Wright lists such files without warning.
- **FINDING-2** — The engine's `Get-Parameter` macro ignores `environmentsSettings.defaultEnvironment`
  and reads `SystemParameters` unless the bot passes `--Environment:`. Selecting an environment in
  Test Wright uploads it, but bots only see it when they name it.
