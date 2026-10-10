# Module 3: Build a run plan

[⬅ Back to overview](README.md)

⏱️ **About 6 minutes**

A **plan** is the list of bots you want to run, in the order you want them run. In this module you'll build one with drag and drop, and save it so you can use it again.

In this module, you will:

- Drag bots and whole suites into the Testing Plan
- Reorder, untick, and remove plan rows
- Save the plan to the repository, export it, and load it back

---

## Step 1: Drag bots into the plan

Drag a bot from the **Bots Tree** and drop it on the **Testing Plan**. A row appears with the bot's name, its suite and file, and the status **Not Run**.

Drag a **suite** to add every bot in it at once.

> **💡 Tip:** A line shows where the bot will land. Drop it between two rows to put it exactly there. You can add the same bot more than once — for example to run it before and after another bot.

---

## Step 2: Arrange the plan

| To... | Do this |
| --- | --- |
| Change the order | Drag a row by its handle (the dots on the left) to a new place |
| Skip a bot this time | Untick its checkbox. Only ticked rows run |
| Remove a bot | Click the **×** at the end of its row |
| Start over | Click **Clear plan** (the crossed circle) and confirm |

At the top of the plan, **items** counts every row and **checked** counts the rows that will run.

> **📝 Note:** The plan runs **top to bottom**. The order matters when one bot prepares something that the next bot uses.

---

## Step 3: Save the plan to the repository

Click **Save plan to repository** (the disk icon). Type a name and press **Save**.

The plan is saved as a `.json` file in the plans folder (`.repositories` in your project by default) and appears in the right sidebar, under **Test Plans Repository**.

To load a saved plan, **drag it onto the Testing Plan** or **double-click** it. Test Wright asks before replacing a plan that is not empty.

> **💡 Tip:** Turn on **Append** in the Test Plans Repository to add a saved plan to the end of the current one instead of replacing it.

---

## Step 4: Export and import

To keep a plan somewhere else (for example to send it to a teammate), click **Export plan to file** (the arrow up) and choose where to save it.

To load a plan file, click **Import plan from file** (the arrow down) and pick the file.

---

## ✔ Check your work

- [ ] The Testing Plan has at least two bots, in the order you want
- [ ] **checked** shows how many will run
- [ ] Your plan is listed under **Test Plans Repository**

---

**Next up** 👉 [Module 4: Run the plan](04-run-the-plan.md)
