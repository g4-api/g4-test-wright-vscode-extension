# Run Your Bots — Test Your Automations with G4 Test Wright

Welcome! 👋

You have bots that work. Now you want to run them **as tests**: many at once, in an order you choose, with a clear **passed** or **failed** for each one, and a report you can share.

**G4 Studio Test Wright** does exactly that, inside VS Code. It finds every bot in your project, lets you build a **run plan** by dragging bots into it, runs the plan against the G4 engine, and saves every run with its reports — including an **Allure** report. No code, no commands.

Plan for about **35 minutes** the first time through.

---

## Who is this for?

Testers, analysts, and developers who have a G4 project with bots in it. You do not need to know JSON, Python, or Allure. Every button is explained in plain words.

## What you'll do

By the end you will be able to:

- Open Test Wright and find your bots, suites, and tags
- Build a **run plan** with drag and drop, and save it for later
- Choose an **environment** and run the plan, one bot at a time or in parallel
- Read the result of every bot, and understand why a bot **failed** or got a **warning**
- Open a run's **G4 reports** and its **Allure report**
- **Schedule** a run for later

## Prerequisites

- VS Code with the **G4 Studio Test Wright** extension installed
- A G4 project open in VS Code: the folder that holds `manifest.json` and a `bots` folder with at least one bot
- The G4 engine running (the [G4 sandbox](https://github.com/g4-api/g4-sandbox) starts it for you)

> **💡 New words:** A **bot** is your automation file. In Test Wright every bot is a **test**, and every folder of bots is a **suite**. A **plan** is the list of bots you want to run. A **run** is one press of **Run**: it is saved with its results in a folder of its own.

---

## Modules

Work through these in order. Each one builds on the previous.

| # | Module | What you'll do | Time |
| --- | --- | --- | --- |
| 1 | [Open Test Wright](01-open-test-wright.md) | Open the page and find your way around it | ~3 min |
| 2 | [Discover your bots](02-discover-your-bots.md) | Fill the Bots Tree, then filter it by name and tag | ~4 min |
| 3 | [Build a run plan](03-build-a-run-plan.md) | Drag bots into the plan, order them, and save the plan | ~6 min |
| 4 | [Run the plan](04-run-the-plan.md) | Pick an environment, run, watch, and stop | ~6 min |
| 5 | [Read the results](05-read-the-results.md) | Understand each status and open the G4 reports | ~6 min |
| 6 | [Open the Allure report](06-open-the-allure-report.md) | Build an Allure report for one run or all runs | ~5 min |
| 7 | [Schedule a run](07-schedule-a-run.md) | Run a plan later, automatically | ~5 min |

**Stuck along the way?** See [Troubleshooting](troubleshooting.md).

---

**Ready?** 👉 Start with [Module 1: Open Test Wright](01-open-test-wright.md)
