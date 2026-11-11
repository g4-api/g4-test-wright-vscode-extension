# Test Wright Learning Paths

<!-- When you add a path, add a row to "Paths at a glance" and a section below. -->

Welcome! 👋 These guided **learning paths** take you from "I have some bots" to running them as tests with **G4 Studio Test Wright**: plans, runs, results, reports, and schedules — click by click, in plain language.

Each path is a **self-contained folder of numbered modules** you can work through in order, or dip into whenever you need a specific answer.

> **💡 New here?** Start with **[Run Your Bots](run-your-bots/README.md)** — it adds practice bots to your project and walks you through every part of Test Wright.

---

## Paths at a glance

| # | Path | Best for | What you'll do | Time | Level |
| --- | --- | --- | --- | --- | --- |
| 1 | [📗 Run Your Bots](run-your-bots/README.md) | Testing your automations | Build a plan, run it, read the results, open Allure, schedule runs | ~65 min | Beginner |
| 2 | [📘 Data-Driven Runs](data-driven-runs/README.md) | Testing with many sets of values | Make bots read columns, fill the iterations sheet, import and export data, read each iteration | ~35 min | Intermediate |
| 3 | [📙 Allure in Depth](allure-in-depth/README.md) | Understanding and sharing your reports | See how results become Allure, read the categories, find every folder, fix a failing Allure command, share a report offline | ~34 min | Intermediate |
| 4 | [📕 Diagnose a Failing Run](diagnose-a-failing-run/README.md) | Finding out why a run is not green | Match a status to its rule, read the output channel, understand engine errors, rerun one bot, read run.json from a script | ~30 min | Intermediate |

---

## Paths

### 📗 Run Your Bots

Run your bots as tests: many at once, in the order you choose, with a clear **passed** or **failed** for each one and a report you can share.

**You'll learn to:**

- Find your bots and build a run plan, then save it and use it again
- Run the plan, follow it live, and find out why a bot failed
- Open an Allure report for one run or for all your runs
- Schedule a run and make your bots better tests

**Format:** 12 modules · practice bots · troubleshooting · ~65 minutes · beginner-friendly

👉 **[Start Run Your Bots »](run-your-bots/README.md)**

[⬆ Back to the index](#paths-at-a-glance)

---

### 📘 Data-Driven Runs

Run the same plan once for every row of a table: different users, different values, a clear result for each row.

**You'll learn to:**

- Make a bot read `{{$ columns.Name }}` values
- Fill the iterations sheet and understand why a run is refused
- Give a bot its own data, and export or import a data file
- Read the result of every iteration in the plan, the files, and Allure

**Format:** 6 modules · 1 practice bot · troubleshooting · ~35 minutes · intermediate (finish Run Your Bots first)

👉 **[Start Data-Driven Runs »](data-driven-runs/README.md)**

[⬆ Back to the index](#paths-at-a-glance)

---

### 📙 Allure in Depth

Open the box behind the Allure report: how each result becomes an Allure test, what the categories mean, where the folders live, and how to share a report with someone who has no G4.

**You'll learn to:**

- Follow a bot from its result to an Allure test, with its labels, parameters, and steps
- Read the four categories and tell a failed check from an engine problem
- Find the results, report, merged, and older folders
- Understand why a report is air-gapped and why its links do nothing
- Read the message when the Allure command fails, and share a report offline

**Format:** 6 modules · troubleshooting · ~35 minutes · intermediate (finish Run Your Bots first)

👉 **[Start Allure in Depth »](allure-in-depth/README.md)**

[⬆ Back to the index](#paths-at-a-glance)

---

### 📕 Diagnose a Failing Run

A bot is red, a run says **Broken**, or the engine does not answer. These short how-to guides show how to find out why, and how to prove your fix.

**You'll learn to:**

- Match a status to the rule that set it, and read its message
- Open the output channel and change the log level
- Read the engine errors that Test Wright reports
- Rerun only the bot you fixed
- Read a run from a script and stop a pipeline when it is not green

**Format:** 5 how-to guides · troubleshooting · ~30 minutes · intermediate (finish Run Your Bots first)

👉 **[Start Diagnose a Failing Run »](diagnose-a-failing-run/README.md)**

[⬆ Back to the index](#paths-at-a-glance)

---

## Quick help

Not sure which path you need? These three pages cover the whole product.

| Page | Best for | What it holds |
| --- | --- | --- |
| [Troubleshooting](troubleshooting.md) | A message you do not understand | One card per message: cause, check, fix, and the source line |
| [Recipes](recipes.md) | A common job | Five short recipes: nightly smoke run, one bot for ten users, DEV and QA, share a report offline, rerun a single failure |
| [Files and settings reference](files-and-settings-reference.md) | Looking up a field or a key | Every file Test Wright reads or writes, the manifest keys it uses, the merge rule, and its limits |

---

## How these work

- **Self-contained** — everything (text, images, and practice bots) lives in this folder, so the guides work offline and travel with the extension.
- **Numbered modules** — follow them in order for a smooth ramp, or jump straight to the one you need.
- **Check your work** — every module ends with a short checklist so you always know you're on track.

Happy testing! 🎉
