# Troubleshooting: Run Your Bots

[⬅ Back to overview](README.md)

Find your symptom below. Each entry says what you see, why it happens, and what to do.

---

## The Engine dot is red

- **Symptom:** The engine address in the top-right corner has a red dot.
- **Cause:** Test Wright cannot reach the G4 engine: it is not running, or the address in `manifest.json` is wrong.
- **Fix:** Start the G4 engine. Check the `g4Server` section of `manifest.json` (Test Wright uses `http://localhost:9944` when there is none). Then click the engine address to check again. See [Module 1](01-get-set-up.md).

---

## Add Practice Bots says "Open a G4 project"

- **Symptom:** The command shows a warning and adds nothing.
- **Cause:** The folder open in VS Code is not a G4 project: there is no `manifest.json` in it (or in its `src` folder).
- **Fix:** Open your G4 project folder (**File → Open Folder**), then run **Add Practice Bots** again. See [Module 1](01-get-set-up.md).

---

## Discover Bots is greyed out

- **Symptom:** You can't press **Discover Bots**.
- **Cause:** No bots folder is selected, or a discovery is already running.
- **Fix:** Click **Browse** next to **Bots** in the header and pick the folder that holds your bots. See [Module 2](02-tour-the-workbench.md).

---

## A bot is missing from the Bots Tree

- **Symptom:** A bot file is in the folder, but not in the tree.
- **Cause:** The file is not a bot Test Wright can read: it does not end in `.json`, `.g4`, or `.g4bot`; it is not valid JSON; it has no `stages`; or it is inside a folder whose name starts with a dot, `node_modules`, or `reports`.
- **Fix:** Open the **console** — every skipped file is listed there with the reason. Fix the file and press **Discover Bots** again. Also check that the filter box and the tag filter are empty. See [Module 3](03-discover-your-bots.md).

---

## The tag filter says "No tags yet"

- **Symptom:** The tag filter is greyed out.
- **Cause:** None of the discovered bots has tags.
- **Fix:** Add a `tags` list to the `reference` section of your bots, then press **Discover Bots** again. See [Module 11](11-make-your-bots-better-tests.md).

---

## A bot opens as text, not in the Workflow Editor

- **Symptom:** Double-clicking a bot opens its JSON text.
- **Cause:** The **G4 Engine Client** extension, which provides the Workflow Editor, is not installed or is disabled.
- **Fix:** Install or enable the G4 Engine Client extension, then double-click the bot again. See [Module 3](03-discover-your-bots.md).

---

## Run is greyed out

- **Symptom:** You can't press **Run**.
- **Cause:** The plan is empty, no row is switched on, or a run is already going.
- **Fix:** Drag bots into the plan and switch at least one on. Wait for the current run to finish, or press **Stop**. See [Module 4](04-build-a-run-plan.md).

---

## Every bot is Broken with "Engine unreachable"

- **Symptom:** All rows end as **Broken**, and the message starts with **Engine unreachable**.
- **Cause:** The engine stopped, or was never running.
- **Fix:** Start the engine, check that the engine dot is green, and run again.

---

## A bot shows Warning, but it did its job

- **Symptom:** The bot finished its work, but its status is **Warning**.
- **Cause:** No check failed, but a step had a problem on the way — for example an element that took too long to appear. Test Wright reports it so you can look, without marking the bot as failed.
- **Fix:** Point at the row, or open the bot's G4 report, to see which step had the problem. See [Module 8](08-read-the-results.md).

---

## A bot passed, but I expected it to fail

- **Symptom:** The bot did the wrong thing, but its status is **Passed**.
- **Cause:** A bot fails only when one of its **checks** (assertions) is false. A bot without checks can't fail.
- **Fix:** Add a check to the bot for what it must prove, such as a text that must appear. See [Module 11](11-make-your-bots-better-tests.md).

---

## An environment says "cannot be used"

- **Symptom:** In the Environment list, an entry is greyed out with **cannot be used**, and you can't pick it. Point at it to see why.
- **Cause:** The engine accepts environment names made only of letters, digits, and `_` — so `visual-staging.json` cannot be used, but `VisualStaging.json` or `visual_staging.json` can. The entry is also greyed out when the file is not valid JSON, or does not hold a list of names and values.
- **Fix:** Rename or fix the file in the `environments` folder, then click **Refresh** in the Environment list. Values may be text, numbers, true/false, or nested objects; Test Wright sends them all to the engine as text. See [Module 6](06-choose-an-environment.md).

---

## "Environment '…' was not synced to the engine" or "…cannot be read"

- **Symptom:** The console shows one of these warnings when a run starts.
- **Cause:** The environment file is not valid JSON, its name has characters the engine does not accept, or the engine did not answer.
- **Fix:** Open the file in the `environments` folder and check it. The run continues with the engine's own copy of the environment (if it has one), so the bots may not find the values they need.

---

## A saved plan was not replaced

- **Symptom:** You saved a plan under an existing name and Test Wright asked **Replace saved plan**.
- **Cause:** Test Wright never overwrites a saved plan without asking.
- **Fix:** Click **Replace** to overwrite it, or **Cancel** and save under another name. See [Module 5](05-keep-your-plans.md).

---

## The Allure report does not open

- **Symptom:** **Open** or **Open Allure** shows an error, or **Open** is greyed out.
- **Cause:** **Open** is greyed out while no folder is chosen, or while a report is being built. An error means the chosen folder has no runs and no Allure results — for example a folder that is not a run or reports folder.
- **Fix:** Pick your reports folder, or a run's folder, in **Allure Reports**. A run made with **Collect** off is converted when you open its report. See [Module 9](09-open-the-allure-report.md).

---

## Schedule Run is greyed out

- **Symptom:** You can't press **Schedule Run**.
- **Cause:** No row in the plan is switched on, the date and time is missing or in the past, or five runs are already scheduled.
- **Fix:** Switch at least one bot on, pick a future time, or cancel a scheduled run. See [Module 10](10-schedule-a-run.md).

---

## A scheduled run did not happen

- **Symptom:** The time passed and the run is not in the **Test Reports Repository**.
- **Cause:** VS Code was closed, or another project was open, when the run was due. Runs whose time passed while VS Code was closed are dropped.
- **Fix:** Keep VS Code open with this project until the run is due, and schedule the run again. See [Module 10](10-schedule-a-run.md).
