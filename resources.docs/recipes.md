# Recipes: G4 Studio Test Wright

Short, step-by-step recipes for common jobs. Each recipe lists the steps, how to check that it worked, and where to read more. Every click path here is taken from a learning path module, which names the code or screen it was checked against.

For messages and problems, see [Troubleshooting](troubleshooting.md).

---

## Run a nightly smoke test with an Allure report

### Run a small set of important bots every evening and read the result in Allure

**Steps:**

1. Add the tag `smoke` to the `reference.tags` list of each important bot, then save the files.
2. Press **Discover Bots**, then tick **smoke** in the tag filter.
3. Clear the plan, then drag the suite onto the plan. Only the filtered bots come in.
4. Turn **Parallel Tests** on if the bots do not depend on each other.
5. Check that **Collect** is on in the Allure section. It is on by default, and each run then writes its Allure results.
6. Pick the environment in the header.
7. Save the plan to the repository, for example as `nightly-smoke`.
8. Type a time in the schedule box and click **Schedule Run**. You can close the Test Wright tab while you wait.
9. After the run, open it in the **Test Reports Repository** and click **Open Allure**.

**Verify:**

- The Run Report shows the run with the counts you expect.
- The Allure report opens, with an overview and categories.

**Related:**

- [Run Your Bots, Module 12: Capstone](run-your-bots/12-capstone-nightly-smoke-run.md)
- [Run Your Bots, Module 10: Schedule a run](run-your-bots/10-schedule-a-run.md)
- [Allure in Depth](allure-in-depth/README.md)

---

## Run one bot for ten users

### Run the same bot ten times with a different user each time

**Steps:**

1. Make the bot read its values with `{{$ columns.User }}` and `{{$ columns.Password }}`. The practice bot `login-with-columns.json` already does.
2. Add the bot to the plan.
3. Click the data button on the plan row, or **Edit iterations**, to open the **Iterations** sheet.
4. Click **Add Iteration** ten times, and type one user and password in each row. **Add Iteration** copies the last row, so change only what differs.
5. To fill many rows at once, click **Export**, edit the JSON file (one entry in `iterations` per user), then click **Import**.
6. Close the sheet and click **Run**.

**Verify:**

- The summary line of the sheet says `10 of 10 iteration(s) included` with no empty values.
- The run folder holds ten report files, named `<suite>.<bot>.p1.i1.g4rpt` to `<suite>.<bot>.p1.i10.g4rpt`.
- The console ends with `10/10 iterations passed.` when all pass.

**Related:**

- [Data-Driven Runs, Module 2: Fill the data sheet](data-driven-runs/02-fill-the-data-sheet.md)
- [Data-Driven Runs, Module 5: Export and import a data file](data-driven-runs/05-export-and-import-a-data-file.md)
- [Data-Driven Runs, Module 6: Read iteration results](data-driven-runs/06-read-iteration-results.md)

---

## Run against DEV and then QA

### Use the same bots in two places without changing the bots

**Steps:**

1. In the project's `environments` folder, make `DEV.json` and `QA.json` with the same names and different values. For example, both hold `"BaseUrl"`, with the address of each place. A file name may hold letters, digits, and `_` only.
2. Make the bots read the value by name with the `Get-Parameter` macro and `--Scope:Application`, and leave out `--Environment`. The bot then uses the environment you pick in the header. The practice bot `practice-environment` names its environment in the macro, so it always reads `Practice`.
3. Open the **Environment** list in the header and click **Refresh**, so the new files show.
4. Pick **DEV**, then click **Run**.
5. When the run ends, pick **QA**, then click **Run** again.

**Verify:**

- The console starts each run with the environment name.
- The Run Report of each run shows its environment.
- Change one value in `QA.json`, run again, and the bot sees the new value without any edit to the bot.

**Related:**

- [Run Your Bots, Module 6: Choose an environment](run-your-bots/06-choose-an-environment.md)

---

## Share an Allure report offline

### Send a report to someone who has no G4 and no internet

**Steps:**

1. Run again, or convert the run, so the report is fresh. Open the report once in Test Wright.
2. In the Explorer, find the report folder: `<run>-allure/report` for one run, or `allure-merged` for all runs together.
3. Compress that folder into one zip file.
4. Send the file.
5. Tell the reader that links to other sites do nothing, and that the report shows the results from the time it was generated.

**Verify:**

- You zipped the `report` folder, not the `results` folder.
- You unzipped it in another folder and opened it the way your reader will. This guide has not tested opening the files from a disk without any server, so the reader may need one.

**Related:**

- [Allure in Depth, Module 4: Air-gapped reports](allure-in-depth/04-air-gapped-reports.md)
- [Allure in Depth, Module 6: Share a report offline](allure-in-depth/06-share-a-report-offline.md)

---

## Rerun a single failure

### Run only the bot that failed, in the same environment

**Steps:**

1. Note the environment of the failed run, from its Run Report.
2. In the **Test Reports Repository**, drag the failed run onto the plan. Click **Replace** when asked.
3. Switch off every row except the bot you fixed.
4. Pick the same environment in the header. Loading a run does not set it for you.
5. Click **Run**.
6. Open the new run from the **Test Reports Repository** and compare its message with the old one.

**Verify:**

- The toolbar says `N items, 1 checked` before the run.
- The new run folder holds one `.g4rpt` file and a `run.json` with `"total": 1`.

**Related:**

- [Diagnose a Failing Run, Module 4: Rerun one bot](diagnose-a-failing-run/04-rerun-one-bot.md)
- [Diagnose a Failing Run, Module 1: Tell why a bot got its status](diagnose-a-failing-run/01-tell-why-a-bot-got-its-status.md)
