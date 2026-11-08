# Diagnose a Failing Run

A bot is red, a run says **Broken**, or the engine does not answer. This path shows how to find out **why**, in the order that saves the most time.

The pages are short how-to guides. Each one has the same parts: **Goal**, **Before you start**, **Steps**, **Verify**, and **If it fails**. Read them in order the first time, then jump to the one you need.

---

## Who is this for?

Anyone who runs bots with **G4 Studio Test Wright** and needs to understand a result that is not green. You do not need to know how to program. The last page shows a small script, and it is optional.

## What you'll do

By the end you will be able to:

- Tell which rule gave a bot its status
- Read the Test Wright output channel and set its log level
- Recognize the engine errors Test Wright reports, and what each one means
- Run a single failing bot again
- Read a run from a script

## What you need

- Test Wright set up as in [Run Your Bots](../run-your-bots/README.md), Module 1
- At least one finished run, so there is something to diagnose. Modules 7 and 8 of Run Your Bots show how to make one
- The practice bots **practice-fail**, **practice-warning**, and **practice-pass** are enough to try every page

---

## Where to look first

| What you see | Start here |
| --- | --- |
| A bot shows **Failed**, **Warning**, or **Broken** and you do not know why | [How to tell why a bot got its status](01-tell-why-a-bot-got-its-status.md) |
| The console is not enough, or the run did not even start | [How to read the output channel](02-read-the-output-channel.md) |
| The message starts with **Engine unreachable**, **HTTP**, or **invalid JSON** | [How to read an engine error](03-read-an-engine-error.md) |
| You fixed a bot and want to prove it | [How to rerun one bot](04-rerun-one-bot.md) |
| You want to check results in a script or a pipeline | [How to read run.json from a script](05-read-run-json-from-a-script.md) |

---

## Modules

| # | Guide | What you'll do | Time |
| --- | --- | --- | --- |
| 1 | [How to tell why a bot got its status](01-tell-why-a-bot-got-its-status.md) | Match a status to the rule that set it, and read its message | ~6 min |
| 2 | [How to read the output channel](02-read-the-output-channel.md) | Open the log, read an entry, and change the log level | ~6 min |
| 3 | [How to read an engine error](03-read-an-engine-error.md) | Understand unreachable, HTTP, invalid JSON, and no-session errors | ~7 min |
| 4 | [How to rerun one bot](04-rerun-one-bot.md) | Run only the bot you just fixed | ~4 min |
| 5 | [How to read run.json from a script](05-read-run-json-from-a-script.md) | Read the tally and the failed bots with a short script | ~5 min |

**Stuck along the way?** See [Troubleshooting](troubleshooting.md).

---

## Words you'll meet

| Word | What it means |
| --- | --- |
| **Check** (assertion) | A step in a bot that compares an expected value with the real one. A bot fails only when a check is false. |
| **Exception** | A problem the engine reports while a step runs, such as a button that is not there. It gives a **Warning**, not a **Failed**. |
| **Engine** | The G4 program that runs your bots. Test Wright sends it each bot and reads the answer. |
| **G4 report** | The saved answer of the engine for one bot, in a `.g4rpt` file. |
| **Output channel** | The VS Code panel named **G4 Test Wright**, where the extension writes its log. |
| **run.json** | The summary file of one run: every bot, its status, and its message. |

---

**Ready?** 👉 Start with [How to tell why a bot got its status](01-tell-why-a-bot-got-its-status.md)
