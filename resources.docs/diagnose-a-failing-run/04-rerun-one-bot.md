# How to rerun one bot

[⬅ Back to overview](README.md)

⏱️ **About 4 minutes**

---

## Goal

Run only the bot you just fixed, with the same environment as the failed run, and compare the new result with the old one.

## Before you start

- A run finished with a bot that is not **Passed**. You fixed the bot, or the engine, or the environment.
- Note the **environment** of the failed run. The Run Report shows it. Dragging a run onto the plan does **not** set the environment for you.

---

## Steps

### Step 1: Load the failed run into the plan

1. In the right sidebar, open **Test Reports Repository**.
2. Drag the failed run onto the **Testing Plan**.
3. If the plan already has rows, Test Wright asks: `Replace the current plan with the bots of run "<name>"?` Click **Replace**. Save the plan first if you want to keep it.

![Dragging a run onto the plan](images/04-drag-run.png)

TODO(screenshot): images/04-drag-run.png - the Test Reports Repository with a run being dragged onto the Testing Plan.

Every bot of the run comes in, in the order of the run, all switched on. A bot that ran in several iterations comes in once.

> **💡 Tip:** Turn **Append** on in the Test Reports Repository to add the bots to the end of your plan instead of replacing it.

### Step 2: Keep only the bot you want

1. Switch off every row except the bot you fixed. Or click the **×** of those rows to remove them.
2. Check the toolbar. It should say `N items, 1 checked`.

![A plan with one row switched on](images/04-one-row-on.png)

TODO(screenshot): images/04-one-row-on.png - the Testing Plan with one row on and the toolbar showing 1 checked.

Rows that are switched off stay in the plan, but they do not run.

### Step 3: Choose the same environment

Open the **Environment** drop-down in the header and pick the environment of the failed run. Test Wright sends that file to the engine at the start of the run.

### Step 4: Run it

Click **Run**. The console starts with `Starting run <name>: 1 plan item(s) on <engine>`, followed by the environment.

### Step 5: Compare the results

1. When the run ends, the row shows the new status.
2. Open the new run from the **Test Reports Repository** and compare its message with the old one.
3. If the bot is still not **Passed**, open its G4 report. See [How to tell why a bot got its status](01-tell-why-a-bot-got-its-status.md).

---

## Rerun one iteration

A run record keeps no data, so the plan you load from a run has **no iterations**. To rerun one iteration of a data-driven plan, do not load the run. Use the plan you ran, open its iterations sheet, and switch off the other iterations with **Include**. The run names the report of each iteration `.pN.iM`, which tells you which iteration failed. See [Data-Driven Runs](../data-driven-runs/README.md).

## Verify

- The new run folder holds one `.g4rpt` file and a `run.json` with `"total": 1`.
- The console ends with `finished in <seconds>s` and the counts for one bot.

## If it fails

| What you see | Why | What to do |
| --- | --- | --- |
| `The run has no bots to rerun.` | The run record lists no tests | Pick another run, or build the plan from the Bots Tree. |
| The new run uses other values than the failed one | The environment is not the one of the failed run | Pick that environment in the header, and run again. |
| The plan has the bot twice | The run was loaded with **Append** on, on top of a plan that already had it | Remove the extra row with **×**. |
| The row stays **Not Run** | The row is switched off | Switch it on. |

---

**Next up** 👉 [How to read run.json from a script](05-read-run-json-from-a-script.md)
