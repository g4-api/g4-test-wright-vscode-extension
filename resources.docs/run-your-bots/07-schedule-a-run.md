# Module 7: Schedule a run

[⬅ Back to overview](README.md)

⏱️ **About 5 minutes**

Want your bots to run tonight, or right before a meeting? In this module you'll schedule a run for later.

In this module, you will:

- Schedule the current plan for a date and time
- Label, load, and cancel scheduled runs
- Decide what happens when two scheduled runs are due together

---

## Step 1: Pick a date and time

Build the plan you want to run later and tick the bots to include.

In the left sidebar, under **Schedule**, click the date box. Pick a day in the calendar and set the hour and minute, or type the date as `YYYY-MM-DD HH:MM`. The time must be in the future.

---

## Step 2: Schedule the run

Click **Schedule Run**. The run appears in the list under the button, with its time, the number of bots, and the environment.

The scheduled run keeps a copy of everything it needs: the ticked bots, the **Parallel Tests** switch, the environment, and the **Collect** switch. You can change the plan right away — the scheduled run is not affected.

> **💡 Tip:** Click the empty box at the top of a scheduled run and type a label, such as **Nightly smoke**. The label is shown in the reports, so you can find the run later.

---

## Step 3: Let it run

When the time comes, the run starts on its own and its rows appear in the **Test Reports Repository** like any other run.

> **📝 Note:** Scheduled runs live in VS Code, not in the Test Wright tab: you can close the tab and they still run. They need VS Code to be open with this project. When you reopen the project, scheduled runs that are still in the future come back; runs whose time passed while VS Code was closed are dropped (the console says so). You can keep up to **five** scheduled runs.

---

## Step 4: Load or cancel a scheduled run

- To see or change what a scheduled run will do, **drag it onto the Testing Plan**. Its bots load into the plan.
- To cancel it, click the **×** on its row.

---

## Step 5: When two runs are due together

The **Parallel Runs** switch next to the **Schedule** title decides what happens when a scheduled run is due while another run is still going:

- **Off** — it waits for the other run to finish.
- **On** — it starts right away, next to the other run.

> **📝 Note:** **Parallel Runs** is about whole runs. **Parallel Tests**, above the plan, is about the bots inside one run.

---

## ✔ Check your work

- [ ] You scheduled a run a few minutes from now
- [ ] It ran on time and appeared in the **Test Reports Repository**

---

🎉 **Well done!** You can now discover, plan, run, review, and schedule your bots.

Something not working? See [Troubleshooting](troubleshooting.md).
