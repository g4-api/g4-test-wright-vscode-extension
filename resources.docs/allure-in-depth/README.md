# Allure in Depth: How Test Wright Builds Your Report

Welcome! 👋

You already know how to open an Allure report from a run. This path opens the box. You will see how every bot result becomes an Allure test, what the four categories mean, where the files live, why a report never reaches the internet, and what to do when the Allure command fails.

Plan for about **35 minutes**. You can stop after any module and come back later.

---

## Who is this for?

Anyone who opened an Allure report in [Run Your Bots](../run-your-bots/09-open-the-allure-report.md), Module 9, and now wants to understand it, fix it, or share it. You do not need to know Allure or how to program.

## What you'll do

By the end you will be able to:

- Say which Test Wright result became which Allure test, step, label, and parameter
- Read the four categories and tell a failed check from an engine problem
- Find the results, report, and merged report folders, including old runs
- Explain why report links do nothing and why a report works offline
- Read the message when the Allure command cannot start, fails, or takes too long
- Share a finished report with someone who has no G4

## What you need

- Test Wright set up as in [Run Your Bots](../run-your-bots/README.md), Module 1
- At least one finished run with **Collect** on
- Optional: the iterations from [Data-Driven Runs](../data-driven-runs/README.md), to see the `Iteration` parameter

You do **not** need Java or Node: Test Wright carries its own Allure 3 command line.

---

## How the pieces fit

Test Wright works in two steps, and each step can fail on its own:

1. **Convert**: the run folder (`run.json` and one `.g4rpt` file per bot) becomes Allure **results**: small JSON files.
2. **Generate**: the bundled Allure 3 command turns the results into a **report**: a folder of web pages. Test Wright then air-gaps the pages and serves them from your own machine.

---

## Modules

Work through these in order. Each one builds on the one before.

| # | Module | What you'll do | Time |
| --- | --- | --- | --- |
| 1 | [How results become Allure](01-how-results-become-allure.md) | Follow one bot from its result to an Allure test | ~7 min |
| 2 | [The categories](02-the-categories.md) | Read the four categories and where they come from | ~5 min |
| 3 | [Merged and legacy folders](03-merged-and-legacy-folders.md) | Find every Allure folder and learn how a selection is read | ~6 min |
| 4 | [Air-gapped reports](04-air-gapped-reports.md) | See what is stripped and why links do nothing | ~6 min |
| 5 | [When the Allure command fails](05-when-the-allure-command-fails.md) | Read each failure message and fix it | ~6 min |
| 6 | [Share a report offline](06-share-a-report-offline.md) | Pick the right folder and send it | ~5 min |

**Stuck along the way?** See [Troubleshooting](troubleshooting.md).

---

## Words you'll meet

| Word | What it means |
| --- | --- |
| **Results** | The Allure input: `*-result.json` files and attachments, in `allure-<run>/results`. |
| **Report** | The Allure output: web pages, in `allure-<run>/report`. |
| **Merged report** | One report built from the results of several runs, in `allure-merged`. |
| **Category** | A group of problems of the same kind, shown on the **Categories** tab. |
| **Air gap** | The rule that a report page may talk only to the local server that shows it. |

---

Ready? 👉 **[Start with Module 1: How results become Allure](01-how-results-become-allure.md)**
