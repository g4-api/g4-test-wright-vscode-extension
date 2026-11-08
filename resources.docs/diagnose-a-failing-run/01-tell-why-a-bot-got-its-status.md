# How to tell why a bot got its status

[⬅ Back to overview](README.md)

⏱️ **About 6 minutes**

---

## Goal

Find the rule that gave a bot its status, and read the one-line reason that goes with it.

## Before you start

- A run has finished, and at least one bot is not **Passed**.
- The practice bots **practice-fail** and **practice-warning** give you a **Failed** and a **Warning** to look at. Run them from [Module 7 of Run Your Bots](../run-your-bots/07-run-and-watch.md).

---

## Steps

### Step 1: Read the message

The reason is written in three places. They all show the same text.

1. **The row** in the Testing Plan. Point at it, and the tooltip shows the message.
2. **The console.** The line of the bot ends with ` - ` and the message.
3. **The Run Report.** Open the run in the Test Reports Repository. The row of the bot shows the message in the dark box.

![The tooltip of a failed row](images/01-row-tooltip.png)

TODO(screenshot): images/01-row-tooltip.png - the Testing Plan with the tooltip of practice-fail showing the expected and actual values.

A bot that **Passed** has no message.

### Step 2: Match the status to its rule

Test Wright sets a status from the answer of the engine. Use this table.

| Status | Set by | Rule | Message you see |
| --- | --- | --- | --- |
| **Passed** | Result evaluator | The answer has a session, no check is false, and no exception was reported. | None |
| **Failed** | Result evaluator | At least one **Assert** step has a check that is not true. | `<name>: expected '<x>' (<operator>) but was '<y>'.` |
| **Warning** | Result evaluator | No check failed, but the engine reported at least one exception. | `<plugin>: <reason>` of the first exception |
| **Broken** | Run service or result evaluator | There is no usable answer. See Step 3. | See Step 3 |
| **Canceled** | Run service | You pressed **Stop**. | `Canceled while running.` or `Canceled before it started.` |

Two rules decide ties:

- **Failed** wins over **Warning**. A bot with a false check and an exception is **Failed**.
- A bot with no **Assert** step can only be **Passed**, **Warning**, **Broken**, or **Canceled**. It can never be **Failed**.

### Step 3: Find out why a bot is Broken

**Broken** means Test Wright could not use an answer. The message says which case it is.

| Message starts with | What happened |
| --- | --- |
| `The bot file cannot be read:` | The bot file is missing or is not valid JSON. The engine was never called. |
| `Engine unreachable at` | The request never reached the engine. See [How to read an engine error](03-read-an-engine-error.md). |
| `HTTP` followed by a number | The engine answered with an error code. See [How to read an engine error](03-read-an-engine-error.md). |
| `The engine answered with invalid JSON:` | The answer is not JSON. See [How to read an engine error](03-read-an-engine-error.md). |
| `The engine response holds no automation session.` | The answer is JSON, but it holds no session, so the automation never started. |
| `The engine answered, but the result could not be saved or evaluated:` | The engine answered, but Test Wright could not write the report file or read the answer. |

### Step 4: Open the G4 report for the details

For **Failed** and **Warning**, the message is only the first problem. The G4 report lists every step.

1. Open the run in the **Test Reports Repository**.
2. Click the bot in the Run Report.
3. In the **Plugin Tree**, find the step with the red dot.
4. Read the **Error Summary**: it shows the expected and the actual value.

![The G4 report of a failed bot](images/01-g4-report.png)

TODO(screenshot): images/01-g4-report.png - the G4 automation report of practice-fail with the Error Summary and a red Assert step.

---

## How the evaluator finds a failed check

You do not need this to fix most bots. It helps when a bot passes but you expected it to fail.

- A step counts as a check when its plugin name is `Assert`, in any letter case. Steps inside other steps are included.
- A check is false when its result has a key named `Evaluation` (in any letter case) whose value is not `true`.
- One false result is enough. The results after it do not matter.
- The same exception text is counted once, even when the engine repeats it on the session and on the step.

The overall status of the **run** is the worst status of its bots, in this order: **Failed**, **Broken**, **Warning**. A run whose bots are only **Passed** and **Canceled** is **Passed**, unless no bot passed at all. Then it is **Canceled**.

---

## Verify

Open the `run.json` of the run. For each bot, the fields `status`, `message`, `assertions`, and `exceptions` match what you read in Steps 1 to 3.

For **practice-fail** you should see `"status": "failed"` and `"assertions": { "total": 1, "failed": 1 }`.

## If it fails

| What you see | Why | What to do |
| --- | --- | --- |
| The bot is **Passed** but you expected **Failed** | The bot has no **Assert** step, or its check compares values that are equal | Open the G4 report and look for the **Assert** step. See [Module 11 of Run Your Bots](../run-your-bots/11-make-your-bots-better-tests.md). |
| The bot is **Warning** and you expected **Failed** | An exception was reported and no check was false | Read the message: it names the step and its problem. Fix the step, or add a check. |
| A **Broken** bot has no G4 report | The engine did not answer, so there was nothing to save | Use the message of the bot. See [How to read an engine error](03-read-an-engine-error.md). |
| The message is empty on a bot that is not **Passed** | The first exception had no text | Open the G4 report, or read the output channel. See [How to read the output channel](02-read-the-output-channel.md). |

---

**Next up** 👉 [How to read the output channel](02-read-the-output-channel.md)
