# Module 6: Open the Allure report

[⬅ Back to overview](README.md)

⏱️ **About 5 minutes**

[Allure](https://allurereport.org) is a popular test report: charts, history, suites, and every step of every test, in a web page you can share. Test Wright builds it for you, with nothing else to install.

In this module, you will:

- Make sure your runs collect Allure results
- Open the Allure report of one run
- Merge every run into one report

---

## Step 1: Collect Allure results

In the right sidebar, open **Allure Reports**. The **Collect** switch is **on** by default: every run then also writes its Allure results to a folder next to the run folder, named after the run with an `allure-` prefix (for example `allure-2026-10-08-213643907`).

> **📝 Note:** Ran a plan with **Collect** off? Open that run's summary and click **Convert to Allure**, or right-click its `run.json` in the Explorer and choose **Convert Run to Allure Results**. The results are written from the saved G4 reports.

---

## Step 2: Open the report of one run

Open the run summary (click the run in the **Test Reports Repository**) and click **Open Allure**.

Test Wright builds the report — the first time takes a few seconds — and shows it in a VS Code tab. Click **Allure in Browser** instead to open it in your web browser.

---

## Step 3: Merge every run into one report

In **Allure Reports**, click the **Allure** folder button and pick:

- **One run folder** (or its `allure-` folder) — the report shows that run only. It is saved in the run's `allure-` folder, under `report`.
- **The reports folder** — the report merges every run in it, so you can see how your bots did over time. It is saved in `reports/allure-merged`.

Then click **Open**. Turn on **Browser** first to open it in your web browser instead of a VS Code tab.

---

## How the bots look in Allure

| Test Wright | Allure |
| --- | --- |
| Bot | Test case |
| Suite (folder) | Suite |
| Tags (`reference.tags`) | Tags |
| Stages, jobs, and rules | Steps, with the rule's main values (argument, element, locator) as step parameters |
| Passed / Failed | Passed / Failed |
| Warning, Broken | Broken |
| Canceled | Skipped |

Screenshots the bot took, the failed checks, and the exceptions are attached to the steps they belong to.

> **💡 Tip:** To see screenshots in the report, either add a **SaveScreenshot** rule where you want a picture, or turn on `autoScreenshots` in the bot's `screenshotsSettings` to get one after every step. Screenshots can be saved as files or returned as Base64 — both show up in the report.

---

## ✔ Check your work

- [ ] **Collect** is on
- [ ] You opened the Allure report of one run
- [ ] You opened one report for the whole reports folder

---

**Next up** 👉 [Module 7: Schedule a run](07-schedule-a-run.md)
