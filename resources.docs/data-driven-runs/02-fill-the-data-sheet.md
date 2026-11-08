# Module 2: Fill the data sheet

[⬅ Back to overview](README.md)

⏱️ **About 7 minutes**

📍 **Where you are:** **Plan**. The data sheet holds the values every iteration sends to the bots of the plan.

In this module, you will:

- Open the iterations sheet
- Add iterations and type values
- Include or skip an iteration
- Duplicate an iteration and copy values between plan items

---

## Step 1: Open the sheet

Use either way:

- Click the **data button** (the table icon) on a plan row. The sheet opens with the cursor in that item's columns.
- Click **Edit iterations** in the plan's header.

The sheet opens in a window titled **Iterations**.

![The empty Iterations sheet](images/02-empty-sheet.png)

TODO(screenshot): images/02-empty-sheet.png

Before you add anything, the sheet says: **No iterations: the plan runs once, and each bot uses its own data source. Add an iteration to run the suite with data.**

---

## Step 2: Add iterations

1. Click **Add Iteration** twice.
2. Look at the sheet:

    ![The sheet with two iterations and the columns User and Password](images/02-two-iterations.png)

    TODO(screenshot): images/02-two-iterations.png

    The numbered parts of the sheet:

    1. **Group header**: the plan position and the bot, for example `#1 login-with-columns`. Two plan items of the same bot are two groups, so each keeps its own values.
    2. **Column header**: one per column. Point at it to see the placeholder, for example `{{$ columns.User }}`.
    3. **Iteration row**: its number, an **Include** switch, **Duplicate**, and **Remove**.
    4. **Value cells**: type the value for that column in that iteration.
    5. **Summary line**: for example `2 of 2 iteration(s) included - 4 empty value(s) to fill`. It turns to a warning while empty values remain.

3. Type these values:

    | Iteration | User | Password |
    | --- | --- | --- |
    | 1 | ann | secret1 |
    | 2 | bob | secret2 |

Values are saved with the plan as you type.

---

## Step 3: Include or skip an iteration

Switch **Include** off on a row to skip that iteration for **every** bot of the plan. Its values stay in the sheet. Switch it on to run it again.

> **📝 Note:** Skipped iterations keep their number. If you skip iteration 2, the next one is still iteration 3.

---

## Step 4: Duplicate and remove

- **Duplicate** adds a new iteration right after the row, with the same values for every bot. Change what differs.
- **Add Iteration** copies the **last** iteration's values.
- **Remove** deletes the row from every bot's table, so all tables stay the same length.

The first iteration of a new table starts from the bot's own data source when it has one (Module 4). Otherwise its cells start empty.

---

## Step 5: Copy values between plan items

Add **login-with-columns** to the plan a second time. It is a second plan item with the same columns, so its group gets a list named **Copy values from...**.

1. Pick the first item from that list.
2. Every value of that item is copied into this one.

![The Copy values from list on the second group](images/02-copy-values.png)

TODO(screenshot): images/02-copy-values.png

The list appears only when another plan item reads the same columns.

---

## Step 6: Columns follow the bot

The sheet reads the bots again when you open it. If you add `{{$ columns.Role }}` to a bot, a **Role** column appears with empty cells. If you remove a placeholder, its column and its values disappear.

> **⚠ Warning:** Removing a placeholder from a bot drops the values typed for it. Export the table first (Module 5) if you may want them back.

---

## 🧪 Try it

Make the table above for **login-with-columns**, then skip iteration 2 and read the summary line.

**You should see:** `1 of 2 iteration(s) included`.

---

## ✔ Check your work

- [ ] You opened the sheet from the data button
- [ ] You added two iterations and typed their values
- [ ] You skipped an iteration with **Include**
- [ ] You know what **Duplicate**, **Remove**, and **Copy values from...** do

---

**Next up** 👉 [Module 3: Why a run is refused](03-why-a-run-is-refused.md)
