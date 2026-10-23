# Run Your Bots — Test Your Automations with G4 Test Wright

Welcome! 👋

You have bots that work. Now you want to run them **as tests**: many at once, in an order you choose, with a clear **passed** or **failed** for each one, and a report you can share.

**G4 Studio Test Wright** does exactly that, inside VS Code. It finds the bots of your project, lets you pick the ones to run by dragging them into a list, runs them on the G4 engine, and keeps every result. No code and no commands.

This learning path shows every part of Test Wright, one small step at a time, with a picture for each step. Plan for about **65 minutes** the first time through. You can stop after any module and come back later.

---

## Who is this for?

Anyone with a G4 project: testers, analysts, and developers. You do not need to know JSON, Allure, or how to program. Every button is explained in plain words.

## What you'll be able to do

By the end you will be able to:

- Find your bots and pick the ones you want to run
- Build a **run plan**, save it, and use it again
- Run the plan and follow every bot while it runs
- Read the result of every bot, and find out **why** a bot failed
- Open a clear **Allure** report you can share
- **Schedule** a run to happen later, by itself
- Make your bots better tests

## What you need

- VS Code with two extensions:
  - **G4 Studio Test Wright** (this one)
  - **G4 Engine Client** — it opens bots in the visual **Workflow Editor**
- A G4 project open in VS Code: the folder that holds `manifest.json`
- The G4 engine running (the [G4 sandbox](https://github.com/g4-api/g4-sandbox) starts it for you)

You do **not** need a browser or a driver: the practice bots you add in Module 1 use a built-in simulator.

---

## How Test Wright works

![How Test Wright works: Bots go into a Plan, the Plan runs on the G4 engine, every Run is saved as Results, and Results become an Allure report. An Environment and a Schedule feed the Run; Saved plans feed the Plan.](images/big-picture.png)

Think of Test Wright as a short assembly line:

1. **Bots** — your automations. Each bot file is one **test**; each folder of bots is a **suite**.
2. **Plan** — the list of bots you want to run, in the order you want. You build it by dragging bots into it.
3. **Run** — one press of the **Run** button. The G4 engine runs every bot of the plan, and Test Wright shows each result as it arrives.
4. **Results** — every run is saved in your project, with a summary and a detailed report for each bot.
5. **Allure** — a clear report built from your results, to read or to share.

Three helpers plug into this line:

- **Saved plans** — keep a plan to use again tomorrow, or share it with a teammate.
- **Environment** — a set of values your bots read (an address, a user name), so the same bots can test different places.
- **Schedule** — start a run later, at a time you pick, without being there.

Every module starts with a short **"Where you are"** line that points to the part of this picture it covers.

---

## Modules

Work through these in order. Each one builds on the one before.

| # | Module | What you'll do | Time |
| --- | --- | --- | --- |
| 1 | [Get set up](01-get-set-up.md) | Open Test Wright, add the practice bots, and check the engine | ~5 min |
| 2 | [Tour the workbench](02-tour-the-workbench.md) | Learn the five areas of the page and what each is for | ~4 min |
| 3 | [Discover your bots](03-discover-your-bots.md) | Fill the Bots Tree, filter it, and open a bot | ~6 min |
| 4 | [Build a run plan](04-build-a-run-plan.md) | Drag bots into the plan, order them, and pick which ones run | ~6 min |
| 5 | [Keep your plans](05-keep-your-plans.md) | Save a plan, load it again, and share it as a file | ~5 min |
| 6 | [Choose an environment](06-choose-an-environment.md) | Pick the values your bots run with | ~5 min |
| 7 | [Run and watch](07-run-and-watch.md) | Run the plan, follow it live, and stop it | ~6 min |
| 8 | [Read the results](08-read-the-results.md) | Understand every status and find out why a bot failed | ~8 min |
| 9 | [Open the Allure report](09-open-the-allure-report.md) | Build a report for one run, or for all your runs | ~6 min |
| 10 | [Schedule a run](10-schedule-a-run.md) | Run a plan later, by itself | ~6 min |
| 11 | [Make your bots better tests](11-make-your-bots-better-tests.md) | Make bots pass, fail, and warn when they should | ~6 min |
| 12 | [Capstone: a nightly smoke run](12-capstone-nightly-smoke-run.md) | Put it all together in one real task | ~5 min |

**Stuck along the way?** See [Troubleshooting](troubleshooting.md).

---

## Words you'll meet

| Word | What it means |
| --- | --- |
| **Bot** | One automation file in your project's `bots` folder. In Test Wright, each bot is a **test**. |
| **Suite** | A folder of bots. Folders inside folders are suites inside suites. |
| **Tag** | A short label in a bot, such as `smoke` or `regression`, used to find bots quickly. |
| **Plan** | The list of bots to run, top to bottom. |
| **Run** | One press of **Run**. Every run is saved in a folder of its own. |
| **Engine** | The G4 program that actually runs your bots. Test Wright talks to it. |
| **Environment** | A file of values (names and their values) that your bots can read. |
| **Check** (assertion) | A step in a bot that compares an expected value with the real one. A bot fails only when a check is false. |
| **G4 report** | The detailed record of one bot's run: every step, its time, and its result. |
| **Allure** | A popular test report format. Test Wright builds Allure reports for you. |

---

**Ready?** 👉 Start with [Module 1: Get set up](01-get-set-up.md)
