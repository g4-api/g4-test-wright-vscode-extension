# Troubleshooting: G4 Studio Test Wright

This page lists the messages Test Wright shows, one card per message. Find the text (a final full stop is left out of the heading), then read the cause, the check, and the fix. Each card ends with the file and line where the message is written.

Messages that come from the learning paths are covered in more depth in their own troubleshooting pages:

- [Run Your Bots](run-your-bots/troubleshooting.md)
- [Data-Driven Runs](data-driven-runs/troubleshooting.md)
- [Allure in Depth](allure-in-depth/troubleshooting.md)
- [Diagnose a Failing Run](diagnose-a-failing-run/troubleshooting.md)

Where a message has a card there, the card below is short and links to it.

---

## Start-up and project

### No manifest.json found in this workspace; the engine defaults to http://localhost:9944

- **Cause:** The folder open in VS Code has no `manifest.json` (and none in its `src` folder).
- **Check:** Look at the first lines of the console. Open the Explorer and look for `manifest.json`.
- **Fix:** Open your G4 project folder (**File → Open Folder**). Without a manifest, Test Wright uses the default engine address and the default folders.
- **Source:** `resources.components/test-wright/modules/test-wright-persistence.js:112`

### Host defaults unavailable: <reason>

- **Cause:** The request `app:getDefaults` failed when the page started, so the defaults were not read. The reason after the colon is the error.
- **Check:** Open the **G4 Test Wright** output channel and look for an error near the start.
- **Fix:** Run **Developer: Reload Window**. If it comes back, close the Test Wright tab and open it again with **Open New Test Wright Tab**.
- **Source:** `resources.components/test-wright/test-wright.js:135`

### Open a G4 project (the folder that holds manifest.json) to add the practice bots

- **Cause:** **Add Practice Bots** needs a project folder with a manifest.
- **Check:** The folder open in VS Code has no `manifest.json`.
- **Fix:** Open your G4 project folder, then run the command again. See [Run Your Bots, Module 1](run-your-bots/01-get-set-up.md).
- **Source:** `src/commands/add-practice-bots.ts:43`

### Unknown request '<name>'

- **Cause:** The page sent a request name the extension has no handler for.
- **Check:** The error shows up in the console as a failed action.
- **Fix:** Run **Developer: Reload Window**, then open Test Wright again.
- **Source:** `src/providers/test-wright-panel-provider.ts:441` (returned to the page at `:449`)

---

## Bots and discovery

### The folder '<path>' does not exist

- **Cause:** The bots folder you picked was moved or deleted.
- **Check:** The console shows `Discovery failed:` with this text.
- **Fix:** Click **Browse** next to **Bots**, pick an existing folder, and press **Discover Bots**.
- **Source:** `src/services/bots-discovery-service.ts:42`

### '<path>' is not a folder

- **Cause:** The bots path points at a file.
- **Check:** The console shows `Discovery failed:` with this text.
- **Fix:** Pick the folder that holds your bots, not a file inside it.
- **Source:** `src/services/bots-discovery-service.ts:39`

### <bot>: skipped, no 'stages' array (not a bot)

- **Cause:** The file is valid JSON, but it has no `stages` list, so it is not a bot.
- **Check:** Open the file and look for a top-level `stages`.
- **Fix:** Fix the bot, or ignore the line if the file is not a bot. See [Run Your Bots, Module 3](run-your-bots/03-discover-your-bots.md).
- **Source:** `src/services/bots-discovery-service.ts:54`

### <bot>: skipped, invalid JSON (<reason>)

- **Cause:** The file cannot be parsed. The reason is the parser's message.
- **Check:** Open the file. VS Code underlines the broken place.
- **Fix:** Repair the JSON and press **Discover Bots** again.
- **Source:** `src/services/bots-discovery-service.ts:60`

### <bot> opened as text: install the G4 Engine Client extension to open bots in the Workflow Editor

- **Cause:** The Workflow Editor comes from the G4 Studio extension, and it is not installed or not enabled.
- **Check:** Open the Extensions view and search for G4.
- **Fix:** Install or enable it, then double-click the bot again.
- **Source:** `resources.components/test-wright/modules/test-wright-tree.js:515`

### <bot> could not be opened: <reason>

- **Cause:** The extension could not open the file, for example because it was moved after discovery.
- **Check:** Look for the file in the Explorer.
- **Fix:** Press **Discover Bots** to read the folder again.
- **Source:** `resources.components/test-wright/modules/test-wright-tree.js:518`

### Clear the tree question: "This clears all discovered bots from the tree..."

- **Cause:** This is a confirmation, not a problem. **Clear** empties the tree. The plan is not changed.
- **Fix:** Click **Continue** to clear, or cancel. Press **Discover Bots** to fill the tree again.
- **Source:** `resources.components/test-wright/modules/test-wright-tree.js:68`

---

## Plans

### Load failed: not a valid Test Wright plan file

- **Cause:** The file is not a Test Wright plan (`type` is not `g4-test-wright-plan`, or it cannot be read).
- **Check:** Open the file and look at the first lines.
- **Fix:** Pick a plan that Test Wright saved or exported. See [Run Your Bots, Module 5](run-your-bots/05-keep-your-plans.md).
- **Source:** `src/providers/test-wright-panel-provider.ts:284`, `:382`; shown by `resources.components/test-wright/modules/test-wright-plan-files.js:28`, `:333`

### Import failed: <reason>

- **Cause:** The picked file is not a plan (or, for iterations, not a data file).
- **Check:** The reason after the colon says which kind of file it was expected to be.
- **Fix:** Pick the right kind of file. For data files see [Data-Driven Runs](data-driven-runs/troubleshooting.md).
- **Source:** `resources.components/test-wright/modules/test-wright-plan-files.js:147`, `resources.components/test-wright/modules/test-wright-data.js:353`

### Nothing to save: the plan is empty

- **Cause:** **Save to repository** has no rows to save.
- **Fix:** Add bots to the plan, then save.
- **Source:** `resources.components/test-wright/modules/test-wright-plan-files.js:234`

### Open a workspace folder or select a plans folder first

- **Cause:** No project is open and no plans folder is picked, so there is nowhere to save.
- **Fix:** Open your project folder, or pick a plans folder with **Browse** in the Test Plans Repository.
- **Source:** `resources.components/test-wright/modules/test-wright-plan-files.js:242`

### Save to repository failed: <reason>

- **Cause:** The file could not be written, for example the folder is read-only or the disk is full.
- **Fix:** Check the plans folder, then save again.
- **Source:** `resources.components/test-wright/modules/test-wright-plan-files.js:298`

### A plan named "<name>" is already in the repository. Replace it with the current plan?

- **Cause:** This is a confirmation. A plan with that name is already saved.
- **Fix:** Click **Replace** to overwrite, or cancel and save under another name.
- **Source:** `resources.components/test-wright/modules/test-wright-plan-files.js:274`

### Plans scan error: <reason>

- **Cause:** The plans folder could not be read.
- **Fix:** Check that the folder exists, then press refresh in the Test Plans Repository.
- **Source:** `resources.components/test-wright/modules/test-wright-plan-files.js:437`

---

## Environments

### Environment '<name>' was not found under environments/

- **Cause:** The environment you picked earlier no longer has a file in the `environments` folder.
- **Fix:** Pick another environment, or restore the file and click **Refresh**.
- **Source:** `resources.components/test-wright/modules/test-wright-environments.js:67`

### Environment '<name>' cannot be used: <issue>

- **Cause:** The file name has a character the engine does not accept, or the file is not valid JSON, or it is not a list of names and values.
- **Check:** The issue after the colon says which one. A file name may hold letters, digits, and `_` only.
- **Fix:** Rename or repair the file, then click **Refresh**. See [Run Your Bots, Module 6](run-your-bots/06-choose-an-environment.md).
- **Source:** `resources.components/test-wright/modules/test-wright-environments.js:72`; the issues are written at `src/services/bots-discovery-service.ts:96` and `:104`

### Environment '<name>' was not synced to the engine: <reason>

- **Cause:** The environment file could not be sent to the engine at the start of the run.
- **Check:** The reason says why. The engine may be stopped, or the name may be rejected.
- **Fix:** Fix the cause and run again. The run goes on with the engine's own copy of the environment, if it has one.
- **Source:** `src/services/run-service.ts:406` (name rule at `:390`, unreadable file at `:398`)

### Environments scan failed: <reason>

- **Cause:** The `environments` folder could not be read.
- **Fix:** Check that the folder exists, then click **Refresh** in the environment list.
- **Source:** `resources.components/test-wright/modules/test-wright-environments.js:76`

---

## Running

### Run failed: <reason>

- **Cause:** The run stopped before it could finish. The reason is the extension's message.
- **Check:** Open the **G4 Test Wright** output channel for the full error.
- **Fix:** Fix the cause, then run again. See [Diagnose a Failing Run](diagnose-a-failing-run/README.md).
- **Source:** `resources.components/test-wright/modules/test-wright-runner.js:125`

### The bot file cannot be read: <reason>

- **Cause:** The bot was moved, deleted, or locked after it was added to the plan.
- **Fix:** Put the file back, or remove the row and add the bot again.
- **Source:** `src/services/run-service.ts:317`

### Canceled before it started. / Canceled while running

- **Cause:** You stopped the run. A bot that had not started is **Canceled** with the first message. A bot that was running is **Canceled** with the second.
- **Fix:** Run again if you stopped by mistake.
- **Source:** `src/services/run-service.ts:158`, `:334`

### Stopping run(s)... (requests in flight are abandoned; the engine may finish its session)

- **Cause:** This is a notice after **Stop**. Test Wright stops waiting for the engine. The engine is not told to cancel.
- **Fix:** Nothing to fix. If the engine keeps working, wait for it, or restart it.
- **Source:** `resources.components/test-wright/test-wright.js:413`

### The engine answered, but the result could not be saved or evaluated: <reason>

- **Cause:** The engine returned a response, but writing the report file or reading the response failed.
- **Check:** The reason says which. A full disk and a missing reports folder are the usual causes.
- **Fix:** Fix the cause and run again.
- **Source:** `src/services/run-service.ts:360`

### The engine response holds no automation session

- **Cause:** The response was valid JSON, but it has no session to judge, so the bot is **Broken**.
- **Fix:** Open its G4 report. See [Diagnose a Failing Run, Module 1](diagnose-a-failing-run/01-tell-why-a-bot-got-its-status.md).
- **Source:** `src/services/result-evaluator.ts:35`

### HTTP <code> <text>: <body>

- **Cause:** The engine answered with an error status. Only the first part of the body is shown.
- **Fix:** Read the body, fix the cause, run again. See [Diagnose a Failing Run, Module 3](diagnose-a-failing-run/03-read-an-engine-error.md).
- **Source:** `src/clients/g4-client.ts:59`

### The engine answered with invalid JSON: <body>

- **Cause:** The engine answered with status 200, but the body is not JSON. A proxy or a wrong address is the usual cause.
- **Fix:** Check the `g4Server` address in `manifest.json`, then run again.
- **Source:** `src/clients/g4-client.ts:65`

---

## Iterations

All the iteration messages (`Run refused`, `Every iteration is excluded`, `Not in this plan, skipped`, `The bot data source is not ...`) have cards in [Data-Driven Runs troubleshooting](data-driven-runs/troubleshooting.md).

---

## Reports and run records

### Report load failed: <reason>

- **Cause:** The run record could not be read.
- **Fix:** Check that the run folder still has its `run.json`, then press refresh in the Test Reports Repository.
- **Source:** `resources.components/test-wright/modules/test-wright-reports.js:57`

### Not a valid Test Wright run record

- **Cause:** The file is not a `run.json` that Test Wright wrote (`type` is not `g4-test-wright-run`).
- **Fix:** Pick the `run.json` from a run folder.
- **Source:** `src/providers/test-wright-panel-provider.ts:290`

### '<file>' is not a Test Wright run record

- **Cause:** You opened **Show Run Report** on a file that is not a run record.
- **Fix:** Pick a `run.json` that Test Wright wrote.
- **Source:** `src/providers/run-report-provider.ts:99`

### No G4 report was saved for '<bot>' (it did not get an engine response)

- **Cause:** The bot never got an answer from the engine, so there is no `.g4rpt` file to open.
- **Check:** The bot's message in the run report says why. Often it is `Engine unreachable`.
- **Fix:** Fix the engine problem and run again.
- **Source:** `src/providers/run-report-provider.ts:68`

### The run has no bots to rerun

- **Cause:** The run record lists no tests.
- **Fix:** Pick another run, or build the plan from the Bots Tree.
- **Source:** `resources.components/test-wright/modules/test-wright-reports.js:66`

### Report open failed: <reason>

- **Cause:** The G4 report of a bot could not be opened.
- **Fix:** Check that the `.g4rpt` file is still in the run folder.
- **Source:** `resources.components/test-wright/modules/test-wright-reports.js:112`

### Reports scan error: <reason>

- **Cause:** The reports folder could not be read.
- **Fix:** Check that the folder exists, then press refresh.
- **Source:** `resources.components/test-wright/modules/test-wright-reports.js:334`

### Select a Test Wright run.json file

- **Cause:** **Show Run Report** or **Convert Run to Allure** was started on something that is not a `run.json`.
- **Fix:** Right-click a `run.json` in the Explorer, then pick the command.
- **Source:** `src/commands/show-run-report.ts:35`, `:67`

### Allure results written to <folder> (<n> result(s))

- **Cause:** This is the success notice of **Convert Run to Allure**.
- **Fix:** Nothing to fix. Open the report from the Allure section.
- **Source:** `src/commands/show-run-report.ts:74`

---

## Allure

### Select an Allure results, run, or reports folder first

- **Cause:** **Open Allure** has no folder to work from.
- **Fix:** Pick a folder with **Browse** in the Allure section.
- **Source:** `resources.components/test-wright/modules/test-wright-allure.js:27`

### Allure open failed: <reason>

- **Cause:** The report could not be generated or served. The reason is the message from the Allure service.
- **Fix:** See [Allure in Depth troubleshooting](allure-in-depth/troubleshooting.md).
- **Source:** `resources.components/test-wright/modules/test-wright-allure.js:65`

### No Allure results under '<folder>'. Turn Collect on and run, or convert a run first

- **Cause:** The folder holds no `allure-<run>/results`.
- **Fix:** Turn **Collect** on and run again, or convert the run.
- **Source:** `src/services/allure-report-service.ts:282`

### This Allure report is already being generated. Wait for it to open

- **Cause:** A second request came for the same report folder while the first was still being written.
- **Fix:** Wait for the first report to open.
- **Source:** `src/services/allure-report-service.ts:293`

---

## Schedules

### Schedule refused: At most <n> runs can be scheduled

- **Cause:** The limit of scheduled runs is reached.
- **Fix:** Cancel a schedule you no longer need.
- **Source:** `src/services/scheduler-service.ts:105`

### Schedule refused: The scheduled time must be in the future

- **Cause:** The time you typed is now or in the past.
- **Fix:** Type a later time. See [Run Your Bots, Module 10](run-your-bots/10-schedule-a-run.md).
- **Source:** `src/services/scheduler-service.ts:109`

### Schedule refused: The plan has no checked items

- **Cause:** Every row of the plan is switched off.
- **Fix:** Switch at least one row on.
- **Source:** `src/services/scheduler-service.ts:113`

### Schedules could not be read: <reason>

- **Cause:** The request for the saved schedules failed. The reason after the colon is the error.
- **Fix:** Reload the window. If it comes back, cancel and create the schedules again.
- **Source:** `resources.components/test-wright/modules/test-wright-schedule.js:217`

### Loading this scheduled run replaces your current plan. Consider saving it first. Replace now?

- **Cause:** This is a confirmation.
- **Fix:** Save the plan first if you want to keep it, then click **Replace**.
- **Source:** `resources.components/test-wright/modules/test-wright-schedule.js:64`
