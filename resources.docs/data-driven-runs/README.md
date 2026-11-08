# Data-Driven Runs: One Suite, Many Sets of Values

Welcome! 👋

A bot that types a fixed user name tests one thing. A bot that reads its values from a table can test many. In **G4 Studio Test Wright** you can run your whole plan once for every row of a table, and see a clear result for each row.

This learning path shows how, one small step at a time. Plan for about **35 minutes**. You can stop after any module and come back later.

---

## Who is this for?

Anyone who already built a run plan in Test Wright. If you did not, work through [Run Your Bots](../run-your-bots/README.md) first, at least Modules 1 to 8. You do not need to know how to program.

## What you'll do

By the end you will be able to:

- Make a bot read values from `{{$ columns.Name }}` placeholders
- Fill the **iterations sheet**: add, duplicate, include, and copy values
- Understand why a run is refused, and fix it
- Give a bot its own data as a file, a JSON array, or Base64 text
- Export the table to a file and import it again
- Read the result of every iteration

## What you need

- Test Wright set up as in [Run Your Bots](../run-your-bots/README.md), Module 1
- The practice bots added to your project. This path uses **login-with-columns**, a practice bot that types a user and a password from two columns
- The G4 engine running

You do **not** need a browser or a driver: the practice bots use a built-in simulator.

---

## How data-driven runs work

Three words matter:

- **Column**: a `{{$ columns.Name }}` placeholder in a bot. `{{$ columns.User }}` is the column **User**.
- **Iteration**: one row of the table. The whole plan runs once for each included iteration.
- **Static bot**: a bot with no column placeholders. It runs unchanged in every iteration.

With 2 iterations and 3 bots, the run goes: iteration 1 runs bot 1, bot 2, bot 3; then iteration 2 runs bot 1, bot 2, bot 3 again, each with its own row.

---

## Modules

Work through these in order. Each one builds on the one before.

| # | Module | What you'll do | Time |
| --- | --- | --- | --- |
| 1 | [Make a bot read columns](01-make-a-bot-read-columns.md) | Find the columns of a bot and put it in the plan | ~5 min |
| 2 | [Fill the data sheet](02-fill-the-data-sheet.md) | Add iterations, fill values, include, duplicate, and copy | ~7 min |
| 3 | [Why a run is refused](03-why-a-run-is-refused.md) | Meet both refusal messages and fix them | ~4 min |
| 4 | [Give a bot its own data](04-give-a-bot-its-own-data.md) | Use a data source as a file, a JSON array, or Base64 | ~6 min |
| 5 | [Export and import a data file](05-export-and-import-a-data-file.md) | Save the table to a file and load it again | ~6 min |
| 6 | [Read the results of each iteration](06-read-iteration-results.md) | Find every iteration in the plan, the files, and Allure | ~7 min |

**Stuck along the way?** See [Troubleshooting](troubleshooting.md).

---

## Words you'll meet

| Word | What it means |
| --- | --- |
| **Column** | A `{{$ columns.Name }}` placeholder in a bot's rules. The name is letters, digits, and `_`. |
| **Iteration** | One row of the table. Each included iteration runs the whole plan once. |
| **Static bot** | A bot with no columns. It runs the same way in every iteration. |
| **Data source** | A bot's own table of values: a file, a JSON array, or Base64 text. |
| **Data file** | A JSON file with the iterations of a plan, written by **Export** and read by **Import**. |

---

Ready? 👉 **[Start with Module 1: Make a bot read columns](01-make-a-bot-read-columns.md)**
