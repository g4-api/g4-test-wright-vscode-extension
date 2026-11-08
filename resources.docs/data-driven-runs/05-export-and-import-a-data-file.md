# Module 5: Export and import a data file

[⬅ Back to overview](README.md)

⏱️ **About 6 minutes**

📍 **Where you are:** **Plan**. A data file saves the iterations on their own, so you can keep them, edit them elsewhere, or use them in another plan.

In this module, you will:

- Export the table to a file
- Read what the file holds
- Import a file, and see how its values find their bots

---

## Step 1: Export

1. Open the **Iterations** sheet.
2. Click **Export** in the sheet's header.
3. Pick a folder and a name. The suggested name is `g4-data-` followed by the time, for example `g4-data-2026-11-08T10-00-00-000Z.json`.

![The Export button in the header of the Iterations sheet](images/05-export.png)

TODO(screenshot): images/05-export.png

The console says `Iterations exported:` with the file path and the number of iterations.

---

## Step 2: Read the file

The file is JSON. This one holds two iterations for one plan item:

```json
{
    "type": "g4-test-wright-data",
    "version": 1,
    "savedAt": "2026-11-08T10:00:00.000Z",
    "iterations": [
        {
            "include": true,
            "items": {
                "5b0e3c0a-6f63-4f0a-9f3e-0f6a4b8f2a11": {
                    "position": 1,
                    "testId": "practice/login-with-columns.json",
                    "values": { "User": "ann", "Password": "secret1" }
                }
            }
        },
        {
            "include": false,
            "items": {
                "5b0e3c0a-6f63-4f0a-9f3e-0f6a4b8f2a11": {
                    "position": 1,
                    "testId": "practice/login-with-columns.json",
                    "values": { "User": "bob", "Password": "secret2" }
                }
            }
        }
    ]
}
```

1. **type** and **version**: they mark the file. A file without `type` equal to `g4-test-wright-data`, or without an `iterations` list, is refused.
2. **iterations**: one entry per iteration, with its **include** switch.
3. **items**: the values of each plan item, under the item's unique key.
4. **position** and **testId**: the plan position and the bot id. They help another plan find the item.

Static bots are not in the file, because they have no values.

---

## Step 3: Import

1. Open the sheet and click **Import**.
2. Pick a data file.

Import **replaces** the current iterations and values. Each entry in the file finds its plan item like this:

1. **By key first.** The same plan gives the same keys, so every value lands where it came from.
2. **Then by position and bot.** In another plan, an entry matches the item at the same position **if** it is the same bot.

Then the table is aligned with the bots: columns the bots no longer read are dropped, and columns the file lacks are filled from the bot's data source or left empty.

![The console after an import](images/05-import-console.png)

TODO(screenshot): images/05-import-console.png

The console reports `Iterations imported:` with the file name, the number of iterations, and the number of plan items matched. Entries that found no item are listed as `Not in this plan, skipped:`, so nothing is lost silently.

---

## Edit the file by hand

The file is plain JSON, so you can write rows for hundreds of users in a script. Keep the `type`, keep one entry per iteration, and keep `position` and `testId` right, then import it.

> **⚠ Warning:** Import replaces what is in the sheet. Export first if you want to keep it.

---

## 🧪 Try it

Export your two iterations. Change `ann` to `carol` in the file. Import it.

**You should see:** `carol` in iteration 1 of the sheet, and the console line `Iterations imported`.

---

## ✔ Check your work

- [ ] You exported the table to a file
- [ ] You can name the four parts of an item in the file
- [ ] You know that Import matches by key, then by position and bot
- [ ] You know where skipped entries are reported

---

**Next up** 👉 [Module 6: Read the results of each iteration](06-read-iteration-results.md)
