# How to read an engine error

[⬅ Back to overview](README.md)

⏱️ **About 7 minutes**

---

## Goal

Understand the messages Test Wright shows when the engine cannot be reached or does not give a usable answer, and decide what to fix.

## Before you start

- A bot is **Broken**, or the engine dot in the header is red.
- You know the address of your engine. Test Wright reads it from the `g4Server` section of `manifest.json`, and uses `http://localhost:9944` when there is none.

---

## Steps

### Step 1: Check the engine dot

The header shows the engine address with a dot. Test Wright asks the engine at `GET /api/v4/g4/ping` and waits up to **3 seconds**.

- **Green dot:** the engine answered with a success code.
- **Red dot:** no answer within 3 seconds, or an error code.

Click the address to check again.

![The engine dot in the header](images/03-engine-dot.png)

TODO(screenshot): images/03-engine-dot.png - the header with a red engine dot and the address next to it.

### Step 2: Find the message

Read the message of the **Broken** bot as in [How to tell why a bot got its status](01-tell-why-a-bot-got-its-status.md). Then match its start to the table in Step 3.

### Step 3: Match the message

| Message | What it means | What to do |
| --- | --- | --- |
| `Engine unreachable at <address>: <reason>` | The request did not reach the engine, or the link broke while the bot ran. | Check that the engine runs and that `g4Server` in `manifest.json` points to it. Read the reason after the colon (Step 4). |
| `HTTP <code> <text>: <start of the answer>` | The engine answered with an error code. The text after the colon is the first 300 characters of its answer, on one line. | Read the text. It usually names the problem. The code is the engine's own answer, not Test Wright's. |
| `The engine answered with invalid JSON: <text>` | The engine answered with a success code, but the body is not JSON. | Open the address in a browser. Something other than the G4 engine, such as a proxy page, may be answering on that port. |
| `The engine response holds no automation session.` | The answer is JSON, but it contains no session, so no automation ran. | Open the bot in the Workflow Editor and check its `driverParameters`. Then look at the engine log. |
| `The bot file cannot be read: <reason>` | Test Wright could not read the bot file. The engine was not called. | Fix or restore the file. |
| `The engine answered, but the result could not be saved or evaluated: <reason>` | The engine answered, but the report file could not be written. | Check that the reports folder exists and that you can write to it. |

A request has **no time limit** on the Test Wright side. A bot that runs for many minutes is not cut off. Only **Stop** ends it early, and then the bot is **Canceled**. The engine may still finish the step it was running.

### Step 4: Read the reason after the colon

For **Engine unreachable**, Test Wright takes the most specific text it can find, in this order:

1. The message of the network error's cause
2. The messages of the inner errors, joined with `; `. A refused connection to `localhost` fails once for each address tried, so you can see two parts, one for `::1` and one for `127.0.0.1`
3. The message of the error
4. The error code, such as `ECONNREFUSED`

Typical reasons:

| Reason | What it means |
| --- | --- |
| `connect ECONNREFUSED ...` | Nothing listens at that address and port. The engine is stopped, or the port is wrong. |
| `read ECONNRESET` | The connection broke while the bot ran. The engine stopped or restarted. |
| `getaddrinfo ENOTFOUND <host>` | The host name in `g4Server` does not exist. |

TODO(verify): the three reasons above are the usual Node.js network errors. They were not reproduced in this session. The code that builds the reason is `getErrorReason` in `src/clients/g4-client.ts`.

> **📝 Note:** An older build showed nothing after the colon when the engine was stopped. The acceptance run of 2026-10-26 recorded this as finding N-10. The current code skips empty texts and falls back to the inner errors and the code, so a reason is always shown. This has not been retested with a stopped Hub in this session: TODO(verify: live).

### Step 5: Check the environment warnings

An environment is sent to the engine **before** the bots run. A problem there does not change a bot's status. It leaves a line in the console, in yellow:

| Console line | What it means |
| --- | --- |
| `Environment '<name>' was not synced: the engine accepts only letters, digits, and _ in environment names. Rename the file.` | The file name has characters the engine rejects, such as `-`. |
| `Environment '<name>' cannot be read; the engine copy (if any) is used.` | The file is missing or is not a JSON object. |
| `Environment '<name>' was not synced to the engine: <reason>` | The upload failed. The reason has the same form as in Step 3. It waits up to 10 seconds. |

If the upload fails, the bots still run. They use the copy of the environment that is already on the engine, if there is one, and may fail on missing values.

---

## Verify

1. Stop the engine, run **practice-pass**, and read the message: it starts with `Engine unreachable at` and has a reason after the colon.
2. Start the engine, click the engine address, and see the dot turn green.
3. Run **practice-pass** again. It is **Passed**.

## If it fails

| What you see | Why | What to do |
| --- | --- | --- |
| The dot is green, but the bot is **Broken** with `HTTP` | The engine is up and rejects this one request | Read the text after the colon. Check the bot with the Workflow Editor. |
| Every bot is **Broken** in a fraction of a second | The engine is down | Start it and run again. |
| The run starts, then every bot is **Broken** after some time | The engine stopped during the run | Check the engine log, then run again. |
| The reason after the colon is empty | An older build of the extension | Update the extension. See the note in Step 4. |

---

**Next up** 👉 [How to rerun one bot](04-rerun-one-bot.md)
