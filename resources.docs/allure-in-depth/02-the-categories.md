# Module 2: The categories

[⬅ Back to overview](README.md)

⏱️ **About 5 minutes**

📍 **Where you are:** **Generate**, the second step. The report groups your problems into categories, and Test Wright decides what those categories are.

In this module, you will:

- Read the four categories and the rule behind each one
- Tell a broken bot with a real exception from one the engine never answered
- See where Allure 3 reads the categories from

---

## Step 1: Open the Categories tab

Open an Allure report that has a failed bot, then click **Categories**.

![The Categories tab with its four groups](images/02-categories.png)

TODO(screenshot): images/02-categories.png

Allure shows only the categories that have at least one bot in them.

---

## Step 2: Read the four categories

A bot lands in a category by its Allure **status** and, for broken bots, by the start of its **message**:

| Category | Status | Message rule | What it means |
| --- | --- | --- | --- |
| Failed assertions | Failed | Any | A check in the bot was false. |
| Exceptions (warnings) | Broken | Does **not** start with `Engine unreachable` or `HTTP ` | The bot ran and raised exceptions, or its file was not valid. |
| Engine or transport errors | Broken | Starts with `Engine unreachable` or `HTTP ` | Test Wright could not talk to the engine, or the engine answered with an HTTP error. |
| Canceled | Skipped | Any | The run was stopped before the bot finished, or the bot never ran. |

A broken bot goes to exactly one of the two broken categories, so the two lines never overlap.

> **💡 Tip:** Start with **Engine or transport errors**. If many bots are there, the problem is the engine or the network, not the bots.

---

## Step 3: Know where the categories come from

Allure 2 reads categories from a `categories.json` file inside the results. Allure 3, which Test Wright uses, reads them from its **configuration**. Test Wright writes both from the same list.

Before each report is generated, Test Wright writes a small configuration file named `allurerc.json` to the extension's storage folder:

```json
{
    "categories": [
        {
            "name": "Failed assertions",
            "matchedStatuses": ["failed"]
        },
        {
            "name": "Exceptions (warnings)",
            "matchedStatuses": ["broken"],
            "messageRegex": "^(?!Engine unreachable|HTTP ).*"
        },
        {
            "name": "Engine or transport errors",
            "matchedStatuses": ["broken"],
            "messageRegex": "^(Engine unreachable|HTTP ).*"
        },
        {
            "name": "Canceled",
            "matchedStatuses": ["skipped"]
        }
    ]
}
```

The file is rewritten every time, so you never edit it by hand.

---

## 🧪 Try it

Stop the engine, run one bot, and open its Allure report.

**You should see:** the bot in **Engine or transport errors**, with a message that starts with `Engine unreachable`.

---

## ✔ Check your work

- [ ] You opened the **Categories** tab
- [ ] You can name all four categories
- [ ] You know why a broken bot is in only one category
- [ ] You know that Allure 3 gets the categories from its configuration

---

**Next up** 👉 [Module 3: Run and merged folders](03-merged-and-legacy-folders.md)
