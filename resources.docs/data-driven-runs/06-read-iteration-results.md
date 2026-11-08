# Module 6: Read the results of each iteration

[⬅ Back to overview](README.md)

⏱️ **About 7 minutes**

📍 **Where you are:** **Results** and **Allure**, the last two stops on the line. A data-driven run makes one result per plan item and iteration.

In this module, you will:

- Follow a data-driven run in the console
- Read the verdict on a plan row
- Find the report file of each iteration
- Read the iteration in `run.json` and in Allure

---

## Step 1: Run and watch

Build a plan with **login-with-columns** and **practice-pass**, add two iterations, fill them, and press **Run**.

The console shows the order. Iteration 1 runs every item, then iteration 2 runs every item again:

```text
Starting run ...: 2 plan item(s), 2 iteration(s) on http://localhost:9944.
Iteration 1 (1 of 2).
Iteration 2 (2 of 2).
```

![The console of a run with two iterations](images/06-console.png)

TODO(screenshot): images/06-console.png

A skipped iteration is not run. If you skip iteration 1, the console starts at `Iteration 2 (1 of 1).`

---

## Step 2: Read the plan row

A plan row shows the **worst** result of its iterations, with a message that counts them:

```text
1/2 iterations passed. Iteration 2: <reason>
```

The message names the first iteration that did not pass, and why. When every iteration passes, it reads `2/2 iterations passed.`

![A plan row with the message 1/2 iterations passed](images/06-plan-row.png)

TODO(screenshot): images/06-plan-row.png

The worst status wins, from best to worst: passed, canceled, warning, broken, failed.

---

## Step 3: Find the report files

Every execution has its own report file in the run folder. The name holds the bot, the plan position, and the iteration:

```text
reports/
└── 2026-11-08-101500000/
    ├── run.json
    ├── practice.login-with-columns.p1.i1.g4rpt
    ├── practice.login-with-columns.p1.i2.g4rpt
    ├── practice.practice-pass.p2.i1.g4rpt
    └── practice.practice-pass.p2.i2.g4rpt
```

`.p1` is the plan position, and `.i2` is the iteration. A plan without iterations has no `.iN` part. Open a `.g4rpt` file as in [Run Your Bots, Module 8](../run-your-bots/08-read-the-results.md).

---

## Step 4: Read run.json

`run.json` has one entry per execution. For a data-driven run, each entry holds:

| Field | What it holds |
| --- | --- |
| `position` | The plan position, starting at 1 |
| `iteration` | The iteration, starting at 1. It is 0 or missing when the plan had no iterations |
| `values` | The row that was sent, column name to value. It is missing for a static bot |
| `reportFile` | The name of the `.g4rpt` file of this execution |

The run record also has `iterations`, the number of iterations the run went through.

---

## Step 5: Read Allure

Allure shows each iteration as its own test case. Each case gets parameters:

| Parameter | When it appears |
| --- | --- |
| `Position` | The same bot is in the plan more than once. Its value looks like `#2` |
| `Iteration` | The plan has iterations. Its value is the iteration number |
| One per column | The row that was sent, for example `User` and `Password` |

![An Allure test case with the parameters Iteration, User, and Password](images/06-allure-parameters.png)

TODO(screenshot): images/06-allure-parameters.png

Each iteration also has its own history, so a failing row keeps its own trend. See [Run Your Bots, Module 9](../run-your-bots/09-open-the-allure-report.md) to open the report.

> **⚠ Warning:** The values of every column appear in Allure and in `run.json`. Do not put real passwords in a table you share.

---

## 🧪 Try it

Run two iterations where iteration 2 uses a user that makes the bot fail, or switch one iteration off.

**You should see:** the plan row message `1/2 iterations passed.`, or a console that starts at the second iteration.

---

## ✔ Check your work

- [ ] You followed the iteration lines in the console
- [ ] You read the `x/y iterations passed` message
- [ ] You found the `.pN.iM` report files
- [ ] You know the `Position`, `Iteration`, and column parameters in Allure

---

**You finished this path.** 🎉 Back to the [overview](README.md), or open [Troubleshooting](troubleshooting.md) if something did not work.
