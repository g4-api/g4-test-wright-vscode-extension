# Module 5: When the Allure command fails

[⬅ Back to overview](README.md)

⏱️ **About 6 minutes**

📍 **Where you are:** **Generate**, when it goes wrong. You will read every message Test Wright shows around the Allure command, and know what to do.

In this module, you will:

- Learn how Test Wright runs the Allure command
- Read the messages for "cannot start", "exited with a code", and "too slow"
- Find the log that holds the full Allure output
- Read the messages that come before the command runs

---

## Step 1: Know how the command runs

Test Wright runs the Allure 3 command line from its own `node_modules` folder. It uses the Node runtime that VS Code already has, so you need no Java and no separate Node.

The command is `generate`, with your results folders, the report folder, the report name, and the configuration file from [Module 2](02-the-categories.md). It gets **5 minutes**. After that Test Wright stops it.

---

## Step 2: Read the messages

Where you see a message depends on where you pressed **Open**:

- In **Allure Reports**: the console line `Allure open failed: <message>`.
- In the Run Report: a red notice with the message.

![The console line for a failed Allure open](images/05-open-failed.png)

TODO(screenshot): images/05-open-failed.png

| Message | Cause | Fix |
| --- | --- | --- |
| `The Allure CLI could not start: <reason>` | The process could not be created: the file is missing, or the system refused it. | Reinstall the extension. A damaged install may lack the Allure files. |
| `Allure generate exited with code N: <last lines>` | The command ran and stopped with an error. The message shows the last three lines of its output. | Read those lines. A broken results file is the usual cause: convert the run again. |
| `Allure generate exited with code null: ...` | Probably the 5-minute limit: Test Wright stopped the command, so no exit code exists. | Select fewer runs, or one run, and try again. |
| `No Allure results under '<folder>'. Turn Collect on and run, or convert a run first.` | The folder has no `*-result.json` files, and it is not a run folder. | Pick a run folder or the reports folder, or run with **Collect** on. See [Module 3](03-merged-and-legacy-folders.md). |
| `This Allure report is already being generated. Wait for it to open.` | A second **Open** for the same report folder. | Wait for the first one. |
| `Select an Allure results, run, or reports folder first.` | The **Allure folder** box is empty. | Click **Browse** and pick a folder. |

The "null" row is a reading of the code, not something seen on a screen: a stopped command is closed without an exit code, and the message prints that code as it is.

---

## Step 3: Find the full output

Test Wright writes the whole Allure output to the **G4 Test Wright** output channel, under the logger name `G4.TestWright.AllureReport`, as a line that starts with `allure generate:`. Open the **Output** panel and pick **G4 Test Wright** to read it.

> **💡 Tip:** When you report a problem, copy that line. It holds what the command printed.

---

## Step 4: Know what happens before the command

Two things are checked first, in this order:

1. If the selection has no results and is a run folder, Test Wright converts the run. An unreadable `run.json` fails the conversion, and the notice shows the reason.
2. If there are still no results, you get the `No Allure results under ...` message.

Only then does the command run, and only after it succeeds are the pages air-gapped, as in [Module 4](04-air-gapped-reports.md).

---

## 🧪 Try it

Press **Open** with an empty folder selected.

**You should see:** `Allure open failed: No Allure results under '<folder>'. Turn Collect on and run, or convert a run first.`

---

## ✔ Check your work

- [ ] You know the command gets 5 minutes
- [ ] You can match each message to its fix
- [ ] You know where the full Allure output is logged
- [ ] You know that the "null" row is a reading of the code

---

**Next up** 👉 [Module 6: Share a report offline](06-share-a-report-offline.md)
