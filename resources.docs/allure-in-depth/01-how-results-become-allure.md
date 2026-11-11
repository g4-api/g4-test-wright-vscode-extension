# Module 1: How results become Allure

[⬅ Back to overview](README.md)

⏱️ **About 7 minutes**

📍 **Where you are:** **Convert**, the first of the two steps. Your run folder is read and turned into Allure results.

In this module, you will:

- See which files a conversion writes
- Follow one bot to its Allure test: status, labels, and parameters
- Learn how steps, screenshots, and attachments are built
- Understand the history id, which keeps each execution's history apart

---

## Step 1: Look at what a conversion writes

Open the folder of a run that collected Allure results. Next to the run folder you find an `allure-` folder:

```text
reports/
    20261108-101500/              run.json and one .g4rpt per bot
    20261108-101500-allure/
        results/                    the files written by the conversion
```

![The reports folder with a run folder and its allure folder](images/01-reports-folder.png)

TODO(screenshot): images/01-reports-folder.png

Inside `results` you find:

| File | What it holds |
| --- | --- |
| `<id>-result.json` | One Allure test per execution: a bot at one plan position in one iteration. |
| `<id>-container.json` | The run itself, listing every test as a child. |
| `<id>-attachment.*` | Files attached to a test or a step: the engine answer, screenshots, assertions, exceptions. |
| `environment.properties` | The run values: `Run`, `Environment`, `Engine`, `Bots.Folder`, `Parallel`, `Scheduled`. |
| `executor.json` | The name **G4 Studio Test Wright** and the report name `G4 Run <name>`. |
| `categories.json` | The four categories, for Allure 2 readers. See [Module 2](02-the-categories.md). |

A new conversion **replaces** the old results of the run, so converting twice never doubles the tests.

---

## Step 2: Follow one bot

Every bot execution becomes one Allure test. These are its main fields:

| Allure field | Where it comes from |
| --- | --- |
| Name | The bot name. |
| Full name | The bot id, for example `practice/screens/practice-screenshots.json`. |
| Status | The Test Wright status, mapped below. |
| Status message | The message Test Wright saved for the bot. |
| Start and stop | The times of the bot. A bot canceled before it started takes the run start time, so it stays out of 1970. |

The status mapping is:

| Test Wright | Allure |
| --- | --- |
| Passed | Passed |
| Failed | Failed |
| Warning, Broken (also Queued and Running, if a run is converted early) | Broken |
| Canceled, Not run | Skipped |

![One test in Allure, with its status and message](images/01-one-test.png)

TODO(screenshot): images/01-one-test.png

> **📝 Note:** A comment at the top of `allure-converter.ts` says a bot that never ran is *broken*. The code maps **Not run** to *skipped*. This guide follows the code.

---

## Step 3: Read the labels

Labels are what the **Suites**, **Packages**, and **Behaviors** views group by. Test Wright writes these:

| Label | Value |
| --- | --- |
| `parentSuite` | The name of the bots folder. |
| `suite`, `testClass` | The bot's folder below the bots folder. |
| `package` | The same folder, with `/` turned into `.`. |
| `testMethod` | The bot name. |
| `host` | The machine name found in the response, or this machine. |
| `thread` | `parallel` or `sequential`. |
| `framework`, `language` | `G4` and `g4`. |
| `g4.environment` | The environment of the run, or `(none)`. |
| `g4.engine` | The engine address. |
| `tag` | One label for every tag in the bot's `reference.tags`. |

---

## Step 4: Read the parameters

A plain bot has **no** parameters, so its title stays short. Parameters appear only when two results need telling apart:

- **Position**, such as `#2`: the bot is in the plan more than once.
- **Iteration**, such as `3`: the plan has iterations.
- One parameter per column, such as `User` and `Password`: the values sent in that iteration.

Allure adds parameters to the title, so each row of a data-driven run reads as its own test case.

---

## Step 5: Read the steps

Steps follow the engine answer: stage, then job, then plugin (a rule). Child plugins nest below their parent.

- A **stage** step is written only when the session has **more than one stage**.
- A **job** step is written only when the stage has **more than one job**.
- A step shows the rule's name and, when set, its `argument`, `onElement`, `onAttribute`, a locator other than `XPATH`, and a regular expression other than `.*`.
- The step status is the worst of the step and its children: failed, then broken, then skipped, then passed.

What is attached to a step:

| Attachment | When |
| --- | --- |
| `assertion` | The rule is an assertion. The entities it checked are attached, and the step **fails** if the evaluation is false. |
| A screenshot | The rule is **SaveScreenshot** (or its aliases GetScreenshot and TakeScreenshot), or a rule carries an `AutoScreenshot:` value. |
| `exceptions` | The rule raised exceptions. The step becomes **broken**, with the first message and its stack trace. |

The rule JSON is **not** attached, because the step name and parameters already describe it. The whole engine answer is attached to the test as `g4-response`.

A screenshot value can be a file path, Base64, or a `data:` address. A PNG or JPEG is shown as an image. Anything else is attached as text, so you can still see what the engine sent.

---

## Step 6: Understand the history id

Allure tracks history by an id. Test Wright builds it from the bot id, plus `#position` when the bot is in the plan more than once, plus `@iteration` when the plan has iterations:

```text
smoke/login.json#4@2
```

That is why each execution keeps its own history, and why a retried bot in a merged report shows its older results under **Retries**.

---

## 🧪 Try it

Open a data-driven run in Allure and find a test whose title ends with its `Iteration` and a column value.

**You should see:** the iteration number and the values after the bot name, and a different history for each iteration.

---

## ✔ Check your work

- [ ] You found `results`, `environment.properties`, and a `-result.json` file
- [ ] You can say how a Warning is shown in Allure
- [ ] You know which parameters appear on a plain bot (none)
- [ ] You found the `g4-response` attachment

---

**Next up** 👉 [Module 2: The categories](02-the-categories.md)
