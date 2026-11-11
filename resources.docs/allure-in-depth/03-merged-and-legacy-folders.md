# Module 3: Run and merged folders

[⬅ Back to overview](README.md)

⏱️ **About 5 minutes**

📍 **Where you are:** **Generate**. Before the report is built, Test Wright works out which results folders your selection covers.

In this module, you will:

- Learn the four things you can select
- Find where a single report and a merged report are written
- Know why a second **Open** for the same report is refused

---

## Step 1: Know what you can select

In **Allure Reports**, the **Allure folder** can be any of these. Test Wright tries them in this order:

| You select | What Test Wright uses |
| --- | --- |
| A results folder (it holds `*-result.json` files) | That folder. |
| A run folder (it holds `run.json`) | `<run>-allure/results` beside it. |
| A run's `<run>-allure` folder | Its `results` folder. |
| Any other folder, such as the reports folder | Every results folder found inside it. The search goes into subfolders, up to three levels deep. |

![The Allure folder box with the reports folder selected](images/03-allure-folder.png)

TODO(screenshot): images/03-allure-folder.png

---

## Step 2: Find where the report is written

The report folder depends on how many results folders were found:

| Found | Report folder | Report name |
| --- | --- | --- |
| One | `<run>-allure/report` | `G4 Run <run>` |
| Several | `allure-merged`, inside the folder you selected | `G4 Runs (N)` |

```text
reports/
    20261108-101500-allure/
        results/
        report/                     the report of one run
    allure-merged/                  the merged report of every run below reports/
```

A report folder is rewritten each time you open it. The merged folder is named `allure-merged`, so a later search skips it: it holds no `results` folder.

---

## Step 3: Convert a run on the way

A run made with **Collect** off has no results yet. If you select its run folder and press **Open**, Test Wright first logs `The run has no Allure results yet; converting it...` and converts it. Then it builds the report. **Convert to Allure** in the Run Report does the first half on its own, and shows `Allure results written (N result(s)).`

---

## Step 4: Know the one-at-a-time rule

Two generations into the same report folder would overwrite each other's files. While one is running, a second **Open** for the same report folder is refused with: `This Allure report is already being generated. Wait for it to open.` The **Open** button also stays off during a generation.

---

## 🧪 Try it

Select the reports folder and press **Open** twice quickly.

**You should see:** one report opening and, if the second click got through, the message about the report already being generated.

---

## ✔ Check your work

- [ ] You know the four things you can select
- [ ] You can say where one report and a merged report are written
- [ ] You know what the "already being generated" message means

---

**Next up** 👉 [Module 4: Air-gapped reports](04-air-gapped-reports.md)
