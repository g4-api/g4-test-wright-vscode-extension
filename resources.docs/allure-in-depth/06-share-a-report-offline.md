# Module 6: Share a report offline

[⬅ Back to overview](README.md)

⏱️ **About 5 minutes**

📍 **Where you are:** **Share**, the end of the line. You have a report that works. Now you send it to someone else.

In this module, you will:

- Pick the right folder for one run or for all runs
- Make sure the report is fresh and complete
- Package it and know what the reader will and will not get

---

## Step 1: Choose what to send

| You want to send | Folder |
| --- | --- |
| One run | `<run>-allure/report`, next to the run folder |
| All runs together | `allure-merged`, inside the folder you selected (usually the reports folder) |

Send the **report** folder, not the `results` folder. The results are Allure's input and need the Allure command to be read.

---

## Step 2: Make it fresh

A report shows the results from the moment it was generated. If you ran again, or converted again, open the report once more: it is rewritten each time.

For a merged report, select the folder that holds the runs you want, so that the right runs are inside.

---

## Step 3: Package it

1. In the Explorer, find the folder from step 1.
2. Compress it into one file with your system's zip tool.
3. Send the file.

![The report folder in the Explorer, ready to compress](images/06-report-folder.png)

TODO(screenshot): images/06-report-folder.png

The pages already hold the policy from [Module 4](04-air-gapped-reports.md), so the report does not call other hosts, wherever it is opened. Your reader needs no G4, no VS Code, and no internet.

---

## Step 4: Tell the reader what to expect

- Links to other sites do nothing in the page. That is by design.
- The report shows the results as of the time you generated it.
- Screenshots and attachments travel inside the folder.

> **📝 Note:** Test Wright always shows a report through its own local server. This guide has not tested opening the files straight from a disk, without any server. The report may need one on the reader's side. TODO(verify): open `report/index.html` from a zip on a computer with no server and write down what happens.

---

## 🧪 Try it

Zip the report of your last run, unzip it in another folder, and open it the way your reader will.

**You should see:** the same overview, categories, and steps you saw in VS Code, or a note from your system that a server is needed.

---

## ✔ Check your work

- [ ] You picked the `report` folder, not `results`
- [ ] You opened the report again before sending it
- [ ] You know links to other sites do nothing
- [ ] You tested the file the way your reader will open it

---

🎉 **You finished Allure in Depth.** Need help later? See [Troubleshooting](troubleshooting.md).
