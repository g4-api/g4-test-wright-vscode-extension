# Module 5: Read the results

[⬅ Back to overview](README.md)

⏱️ **About 6 minutes**

Every run is saved. In this module you'll find the run you just made, see its results, open the detailed G4 report of a bot, and rerun bots from an old run.

In this module, you will:

- Find your run in the **Test Reports Repository**
- Read the run summary and open a bot's G4 report
- Rerun the bots of a run
- Know where the run's files are

---

## Step 1: Find your run

In the right sidebar, open **Test Reports Repository**. It lists every run in your project's reports folder, newest first. Each row shows the run's name (the date and time it started), and how many bots passed, failed, and got a warning.

> **💡 Tip:** To see only recent runs, pick a date and time in the box above the list. Clear it to see all runs again.

---

## Step 2: Open the run summary

Click a run. The **Run Report** opens over the page. It shows:

- The run's overall status, when it ran, how long it took, the environment, and the engine
- A tally: how many bots passed, failed, got a warning, broke, or were canceled
- One row per bot, with its status, its time, and — for a bot that did not pass — the reason

Click **Open in Tab** to show the same report in its own VS Code tab, next to your code.

---

## Step 3: Open a bot's G4 report

Click a bot's row in the run summary. Its **G4 automation report** opens in a new tab, with every stage, job, and rule the bot ran, and their results.

> **📝 Note:** A **Broken** bot has no G4 report: the engine never answered, so there is nothing to show. Its row explains why.

---

## Step 4: Why did a bot fail?

| Status | What to look for |
| --- | --- |
| **Failed** | The message names the check (assertion) that was false. Open the G4 report to see the values it compared. |
| **Warning** | The message names the plugin that raised the exception, and its reason. The bot's checks all passed. |
| **Broken** | The message says why the engine gave no usable answer, such as **Engine unreachable**. |

---

## Step 5: Rerun the bots of a run

Drag a run from the **Test Reports Repository** onto the **Testing Plan**. Its bots replace the plan (Test Wright asks first), ready to run again.

> **💡 Tip:** Turn on **Append** in the Test Reports Repository to add the run's bots to the end of the plan instead.

---

## Where are the files?

Each run is one folder in the reports folder. Its Allure files sit next to it, in a folder that starts with `allure-`:

```none
reports/
├── 2026-10-08-213643907/
│   ├── run.json                    # the run summary
│   └── calculator.g4rpt            # one G4 report per bot
└── allure-2026-10-08-213643907/    # Allure files (see the next module)
```

> **📝 Note:** Test Wright creates the `reports` folder (and the `.repositories` folder for plans) when VS Code starts in your project, so they are always there.

In the run summary, **Open run.json** shows the summary file and **Reveal Folder** opens the folder on your computer.

> **💡 Tip:** In the VS Code Explorer, right-click any `run.json` and choose **Open Run Report**.

---

## ✔ Check your work

- [ ] You opened your run from the **Test Reports Repository**
- [ ] You opened the G4 report of one bot
- [ ] You dragged a run onto the plan to load its bots

---

**Next up** 👉 [Module 6: Open the Allure report](06-open-the-allure-report.md)
