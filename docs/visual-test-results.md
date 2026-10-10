# G4 Studio Test Wright — Visual Test Results

Run of [visual-test-plan.md](visual-test-plan.md) on 2026-10-09, 11:58–12:15, in the Extension
Development Host (1920×1080, dark theme) against the G4 engine at `http://localhost:9944`. Every
step was driven with real mouse and keyboard input and checked on a screenshot.

## Summary

| Section | Cases | Pass | Fail | Blocked |
| --- | --- | --- | --- | --- |
| A. Open and discover | 6 | 6 | 0 | 0 |
| B. Tree interactions | 5 | 5 | 0 | 0 |
| C. Plan editing and plan files | 7 | 7 | 0 | 0 |
| D. Run | 7 | 7 | 0 | 0 |
| E. Reports | 7 | 7 | 0 | 0 |
| F. Allure | 5 | 5 | 0 | 0 |
| G. Schedule and multiple tabs | 6 | 6 | 0 | 0 |
| **Total** | **43** | **43** | **0** | **0** |

Every happy flow works. The bugs below were found along the way; none blocked a case, but
BUG-5 made the first attempt of C5 misleading (an extra plan was saved).

## Bugs and findings

| ID | Severity | Area | What happens | Found in |
| --- | --- | --- | --- | --- |
| BUG-5 | Medium | Plans | Pressing **Enter** in **Save plan to repository** saves the plan and immediately opens a second save dialog with a new default name. Focus returns to the toolbar's save button and the same Enter activates it. A following click on the dialog saves an unwanted `g4-plan-<timestamp>.json`. Reproduced twice. | C4, C5 |
| BUG-1 | Medium | Environments | The engine rejects environment names that are not `\w+` (for example `visual-staging`) and non-string values with HTTP 400. Test Wright lists such files without a warning; the run only logs that the sync failed. | Preparation |
| FINDING-2 | Info (engine) | Environments | The engine's `Get-Parameter` macro reads `SystemParameters` unless the bot passes `--Environment:`; it ignores `environmentsSettings.defaultEnvironment`. Selecting an environment uploads it, but bots see it only when they name it. | Preparation |
| BUG-8 | Low | Tree | The last-run icon is not updated for a bot that was canceled before it started: after Stop, `vt-slow-b` kept the ✓ from its previous run. | D7, E6 |
| BUG-3 | Low | Layout | After an editor tab was opened and closed over Test Wright, the left sidebar shrank (≈320 → 250 px) and the right column too. Seen once; not reproduced on later tab switches. | B5 → C1 |
| BUG-6 | Low | Console | The first time the console opens it shows the oldest lines, not the newest. | C7 |
| BUG-4 | Low (cosmetic) | Dialogs | The confirm and save dialogs show their message flush against the left edge (no padding). | C1 |
| BUG-7 | Low (cosmetic) | Reports, schedule | "1 bots" / "1 items"; report rows show no canceled count (a stopped run shows only "2 bots"); a run summary with only canceled bots is logged in green. | D7, E1, G1 |
| FINDING-9 | Low | Allure | Allure 3 ignores `categories.json`: a failed assertion is filed under the default "Product errors", not "Failed assertions". | F3 |
| FINDING-10 | Low (cosmetic) | Allure | Test titles carry the parameters, for example `vt-fail (none),http://localhost:9944`; the environment and engine parameters add noise. | F1 |
| FINDING-11 | Low (cosmetic) | Run report | In the Run Report modal the summary fills only about 75 % of the modal width. | E2 |
| FINDING-12 | Low | G4 report | In the copied G4 automation report, the failed **Assert** step shows a green dot in the plugin tree (the error summary is correct). The component comes from G4 Studio. | E3 |

## Fixes (2026-10-09, after the run)

| ID | Fix | Verified |
| --- | --- | --- |
| BUG-5 | The prompt's Enter handler calls `preventDefault()`, so the same Enter no longer activates the button that gets the focus back. | Visually: Enter saved one plan, no second dialog. |
| BUG-1 | Environment names that are not `\w+` and files that are not a JSON object are listed disabled with the reason; values are sent as text (numbers, booleans, JSON for objects); the run explains a skipped upload. | Visually (disabled entry, tooltip) and against the engine (numbers, booleans, objects stored). |
| FINDING-2 | `g4-plugins`: `GetApplicationParameter` (behind `Get-Parameter --Scope:Application`) falls back to `environmentsSettings.defaultEnvironment`, then `SystemParameters`, as `SetApplicationParameter` already did. | Builds; takes effect after the engine is rebuilt with the new plugins. |
| BUG-8 | Bots are marked queued in the tree when a run starts, so a bot canceled before it starts shows canceled. | Visually: a passed bot turned to canceled after Stop. |
| BUG-3 | Panel widths are clamped only when drawn; the user's widths are never overwritten by a resize (a hidden webview reports no width). | Visually (2026-10-10): opening and closing an editor left both panel widths unchanged. |
| BUG-6 | The console scrolls to the newest line whenever the drawer opens (every path), after layout. | Visually. |
| BUG-4 | New `g4-modal` size `fit`; dialogs use it and pad their body. | Visually. |
| BUG-7 | Singular/plural counts (bot, item), canceled count on report rows, a canceled run's summary logged as a warning. | Visually. |
| FINDING-9 | The Allure 3 CLI gets a config (`allurerc.json` in the extension storage) with Test Wright's categories. | Visually (2026-10-10): the Categories tab lists "Failed assertions". |
| FINDING-10 | Environment and engine are labels (`g4.environment`, `g4.engine`), not parameters. | Service test; visually (2026-10-10): titles are just the bot names. |
| FINDING-11 | The Run Report modal uses size `fit`; the viewer is 920 px wide. | Visually (2026-10-10): the summary fills the modal. |
| FINDING-12 | The G4 report colors a plugin red when one of its assertions evaluated to false (plugin tree and timeline). | Visually (2026-10-10): red dot on the failed Assert in the plugin tree and the timeline. |
| Extra | Escape now closes the environment picker and the tag filter while the focus is on their trigger. | Visually. |

## Notes per section

- **A** — The flask opens Test Wright and collapses the side bar. Discovery found 10 bots in nested
  suites; filter, tag filter (with counts), and collapse/expand all work.
- **B** — Keyboard navigation (↓, ← to parent, ← collapse, → expand), Enter adds to the plan, the
  hover **+** adds a whole suite, drag adds at the drop point, double-click opens the bot.
- **C** — Suite drag, reorder, untick, remove, save to the repository, load (double-click), export
  and import through the native dialogs all work; unticked rows survive save/load.
- **D** — Statuses Passed / Failed / Warning are right, with tree icons and tooltips. The
  environment bot fails with `(none)` and passes with `VisualStaging` (uploaded at run start).
  Parallel Tests ran two 8 s bots in 8.25 s. Stop cancels the running and queued bots and still
  writes the run. Allure results land in `reports/allure-<run>/results`.
- **E** — Reports list (newest first), Run Report modal, bot G4 report, Open in Tab, Open
  run.json, Reveal Folder, drag a run onto the plan, and the Explorer context menu all work.
- **F** — Allure 3 report in a VS Code tab (4 tests, 2 passed / 1 failed / 1 broken); the
  SaveScreenshot steps show their PNG (no rule JSON in the steps); merged report of 8 runs in the
  external browser; Convert to Allure writes 4 results.
- **G** — A scheduled run labeled **Visual nightly** fired on time and is listed with its label;
  a second schedule was canceled. A second tab opened from the side bar button; its run
  was not logged in the first tab's console, while the scheduled run was logged in both.

## Test data left in place

- `bots/visual-tests/` (7 SimulatorDriver bots) and `environments/VisualStaging.json`.
- `.repositories/visual-smoke.json`, `repro-enter.json`, and the BUG-5 extra
  `g4-plan-2026-10-09T09-01-49-499Z.json`; `fix-enter-check.json` from the
  BUG-5 recheck.
- `exports/visual-export.json`.
- Run folders `reports/2026-10-09-1204…` to `…121500005` (and the recheck run
  `2026-10-10-210423107`) with their `allure-<run>` folders, and `reports/allure-merged/`.
