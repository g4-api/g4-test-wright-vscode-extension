# Module 4: Run the plan

[⬅ Back to overview](README.md)

⏱️ **About 6 minutes**

Now the fun part. In this module you'll choose where the bots run, start the run, follow it bot by bot, and learn to stop it.

In this module, you will:

- Pick an environment
- Choose between one-by-one and parallel runs
- Run the plan and follow each bot's status
- Stop a run

---

## Step 1: Pick an environment

An **environment** is a set of values your bots read, such as a web address or a user name for **staging** or **production**. Each file in your project's `environments` folder is one environment.

In the header, click **Environment** and choose one. Choose **(none)** to run the bots without one.

When the run starts, Test Wright sends the chosen environment to the engine and tells every bot to use it.

> **📝 Note:** The environment list also has buttons to refresh it and to open the `environments` folder.

---

## Step 2: One by one, or in parallel

Above the plan is the **Parallel Tests** switch:

- **Off** — the bots run one after another, top to bottom. Use this when the bots depend on each other.
- **On** — several bots run at the same time (one per processor core). Use this when the bots are independent, to finish sooner.

---

## Step 3: Press Run

Click **Run** (the play button above the plan).

Watch the status of each row change:

| Status | Meaning |
| --- | --- |
| **Queued** | Waiting for its turn |
| **Running** | Sent to the engine (three moving dots) |
| **Passed** | Done, and no check failed |
| **Failed** | Done, and at least one check (assertion) failed |
| **Warning** | Done with no failed check, but something went wrong on the way (an exception) |
| **Broken** | No usable answer: the engine could not be reached or returned an error |
| **Canceled** | Stopped before it finished |

The header status says **Running** until every bot is done. Hover a row to see the message of a bot that did not pass.

> **💡 Tip:** Open the **console** (the middle button at the bottom right) to see every step: the environment that was sent, each bot that started and finished, and where the run was saved. A dot on the button means there is something new to read.

---

## Step 4: Stop a run

Click **Stop** (the square button). Bots that are running are stopped, bots that had not started are marked **Canceled**, and the run is still saved with what finished.

---

## What is sent to the engine?

Each bot is sent as it is in its file, with a few additions from your project's `manifest.json`:

- The **token** from the manifest is always used.
- Anything the bot does not set itself (for example the driver or a setting) is taken from the manifest.
- Anything the bot **does** set stays as the bot has it.

Your bot files are never changed.

---

## ✔ Check your work

- [ ] You picked an environment (or **(none)**)
- [ ] You ran the plan and every row ended with a status
- [ ] You know the difference between **Failed** and **Warning**

---

**Next up** 👉 [Module 5: Read the results](05-read-the-results.md)
