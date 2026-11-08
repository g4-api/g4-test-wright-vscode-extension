# Troubleshooting: Allure in Depth

[⬅ Back to overview](README.md)

Find your symptom below. Each entry says what you see, why it happens, and what to do. Messages are shown exactly as Test Wright writes them.

---

## No Allure results under a folder

- **Symptom:** The console says `Allure open failed: No Allure results under '<folder>'. Turn Collect on and run, or convert a run first.`
- **Cause:** The folder has no `*-result.json` files and is not a run folder, so there was nothing to convert.
- **Fix:** Select a run folder or the reports folder. Run with **Collect** on, or use **Convert to Allure**. See [Module 3](03-merged-and-legacy-folders.md).

---

## The Allure CLI could not start

- **Symptom:** `The Allure CLI could not start: <reason>`.
- **Cause:** The process for the Allure command could not be created.
- **Fix:** Reinstall the Test Wright extension. See [Module 5](05-when-the-allure-command-fails.md).

---

## Allure generate exited with a code

- **Symptom:** `Allure generate exited with code N: <last lines>`.
- **Cause:** The command ran and failed. The text after the code is the end of its output.
- **Fix:** Read the lines. Convert the run again to rewrite its results, then open the report. The full output is in the **G4 Test Wright** output channel, on a line that starts with `allure generate:`. See [Module 5](05-when-the-allure-command-fails.md).

---

## Allure generate exited with code null

- **Symptom:** `Allure generate exited with code null: ...`, after a long wait.
- **Cause:** Probably the 5-minute limit. Test Wright stops the command, so it has no exit code. This is read from the code, not seen on a screen.
- **Fix:** Select fewer runs, or one run. See [Module 5](05-when-the-allure-command-fails.md).

---

## The report is already being generated

- **Symptom:** `This Allure report is already being generated. Wait for it to open.`
- **Cause:** You pressed **Open** again for the same report folder before the first generation ended.
- **Fix:** Wait for the first report to open.

---

## A report page has no head

- **Symptom:** `The Allure report page <page> has no <head>, so it cannot be kept off the network; the report was not opened.`
- **Cause:** Test Wright writes the air-gap policy into the `<head>` of every page. A page without one cannot be protected, so the report is refused on purpose.
- **Fix:** Open the report again, so that it is generated again. If it keeps happening, the bundled Allure version may have changed its pages: report it. See [Module 4](04-air-gapped-reports.md).

---

## Links in the report do nothing

- **Symptom:** The **Powered by Allure** link, or a link inside a result, does not open.
- **Cause:** This is by design. The link guard cancels every link to another host.
- **Fix:** None needed. See [Module 4](04-air-gapped-reports.md).

---

## The report is empty or old

- **Symptom:** The report lacks the latest run, or a bot you expect.
- **Cause:** A report shows the results from the moment it was generated, and a merged report holds only the runs below the folder you selected.
- **Fix:** Open the report again. For a merged report, select the folder that holds the runs you want. See [Module 3](03-merged-and-legacy-folders.md).

---

## A bot shows a different status than in Test Wright

- **Symptom:** Test Wright says **Warning** and Allure says **Broken**, or **Not run** shows as **Skipped**.
- **Cause:** Allure has four statuses and Test Wright has more, so some are merged.
- **Fix:** None needed. See the table in [Module 1](01-how-results-become-allure.md).

---

## Select a folder first

- **Symptom:** The console says `Select an Allure results, run, or reports folder first.`
- **Cause:** The **Allure folder** box is empty.
- **Fix:** Click **Browse** and pick a folder.

---

Still stuck? See [Troubleshooting for Run Your Bots](../run-your-bots/troubleshooting.md).

Looking for a message that is not listed here? See the [Test Wright troubleshooting](../troubleshooting.md) page.
