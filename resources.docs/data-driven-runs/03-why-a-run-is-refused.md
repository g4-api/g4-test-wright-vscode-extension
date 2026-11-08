# Module 3: Why a run is refused

[⬅ Back to overview](README.md)

⏱️ **About 4 minutes**

📍 **Where you are:** **Run**. Before it starts a data-driven run, Test Wright checks the table. If something is wrong, nothing runs and the console says why.

In this module, you will:

- Meet the two reasons a run is refused
- Fix each one
- Know that a schedule is checked the same way

---

## Why Test Wright checks first

The engine inserts an empty value as empty text, and does not tell you. A login bot would type nothing and the failure would look like a bug in the bot. So Test Wright refuses the run first and points at the cell.

The same check runs when you press **Run** and when you add a **scheduled run**, so a timed run never starts with empty values.

---

## Refusal 1: empty values

1. Add **login-with-columns** to the plan.
2. Add two iterations, type values in iteration 1 only, and leave iteration 2 empty.
3. Close the sheet and press **Run**.

The console shows a line like this:

```text
Run refused: 2 empty value(s) to fill: #1 login-with-columns iteration 2 'User', #1 login-with-columns iteration 2 'Password'.
```

![The console with the Run refused line and the sheet open at the first empty cell](images/03-run-refused.png)

TODO(screenshot): images/03-run-refused.png

1. **Console line**: the number of empty values, then up to five of them as `#position bot iteration 'column'`. When there are more, it ends with `, and N more`.
2. **The sheet**: it opens by itself, with the cursor in the columns of the first item that has an empty value.

**Fix:** fill every empty cell of an **included** iteration, or switch that iteration off. Excluded iterations are never checked, because they never run.

> **💡 Tip:** The plan row warns you before you press Run. Its data button turns to a warning color while an included iteration has an empty value, and its tooltip says how many.

---

## Refusal 2: every iteration is off

1. Open the sheet and switch **Include** off on every row.
2. Press **Run**.

The console shows:

```text
Every iteration is excluded: include at least one iteration to run the plan.
```

**Fix:** switch at least one iteration on. A plan with **no iterations at all** is fine, it runs once. A plan with iterations that are **all off** has nothing to run.

---

## What is not an error

- **No iterations:** the plan runs once, and each bot uses its own data source, if it has one.
- **A static bot:** it has no cells, so it is never checked.

---

## 🧪 Try it

Cause both refusals on purpose, then fix them until the run starts.

**You should see:** the run starts and the console says `Starting run`, followed by the number of iterations.

---

## ✔ Check your work

- [ ] You caused and read the `Run refused` line
- [ ] You caused and read the `Every iteration is excluded` line
- [ ] You know that excluded iterations are not checked
- [ ] You know that scheduling checks the table too

---

**Next up** 👉 [Module 4: Give a bot its own data](04-give-a-bot-its-own-data.md)
