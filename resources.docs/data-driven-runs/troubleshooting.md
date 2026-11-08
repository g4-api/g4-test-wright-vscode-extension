# Troubleshooting: Data-Driven Runs

[⬅ Back to overview](README.md)

Find your symptom below. Each entry says what you see, why it happens, and what to do. Messages are shown exactly as Test Wright writes them.

---

## Run refused: N empty value(s) to fill

- **Symptom:** The console says `Run refused: 2 empty value(s) to fill: #1 login-with-columns iteration 2 'User', ...`. The run does not start and the sheet opens.
- **Cause:** An included iteration has an empty cell. The engine would insert it as empty text without telling you.
- **Fix:** Fill the cells the message lists, or switch that iteration off. See [Module 3](03-why-a-run-is-refused.md).

---

## Every iteration is excluded

- **Symptom:** The console says `Every iteration is excluded: include at least one iteration to run the plan.`
- **Cause:** The plan has iterations, and all of them are switched off.
- **Fix:** Switch at least one iteration on. See [Module 3](03-why-a-run-is-refused.md).

---

## Import failed: Not a valid Test Wright data file

- **Symptom:** After you pick a file, the console says `Import failed: Not a valid Test Wright data file.`
- **Cause:** The file is missing, is not JSON, does not have `"type": "g4-test-wright-data"`, or has no `iterations` list. A plan file or a bot file is not a data file.
- **Fix:** Pick a file written by **Export**, or fix the `type` and `iterations` of your file. See [Module 5](05-export-and-import-a-data-file.md).

---

## Not in this plan, skipped

- **Symptom:** After an import, the console warns `Not in this plan, skipped: #3 login.json.`
- **Cause:** An entry of the file matched no plan item. Its key is not in this plan, and the item at its position is another bot.
- **Fix:** Put the bot in the plan at the position the file names, then import again. See [Module 5](05-export-and-import-a-data-file.md).

---

## Import iterations canceled / Export iterations canceled

- **Symptom:** The console says `Import iterations canceled.` or `Export iterations canceled.`
- **Cause:** You closed the file dialog without picking a file.
- **Fix:** None needed. Click **Import** or **Export** again when you are ready.

---

## Bot columns could not be read

- **Symptom:** The console warns `Bot columns could not be read: ...` with a reason.
- **Cause:** Test Wright could not ask its host to read the bots, so the sheet shows the columns it already knew.
- **Fix:** Check that the project folder is still open, then open the sheet again. The values you typed are kept.

---

## The bot cannot be read

- **Symptom:** A bot in the plan has no columns, and its data shows `The bot cannot be read: ...`.
- **Cause:** The bot file is missing, was moved, or is not valid JSON.
- **Fix:** Restore the file or fix its JSON, then open the sheet again. Typed values are kept while the bot cannot be read.

---

## The bot data source is not a file, a JSON array, or Base64 of a JSON array

- **Symptom:** The cells of a bot start empty even though it has a `dataSource`.
- **Cause:** `source` is not a readable file, does not start with `[` or `{`, and is not Base64 of JSON.
- **Fix:** Use one of the three forms in [Module 4](04-give-a-bot-its-own-data.md).

---

## The bot data source is not valid JSON

- **Symptom:** The cells start empty. The reason is `The bot data source is not valid JSON: ...`.
- **Cause:** The text looks like JSON but does not parse, for example a missing comma or unescaped quotes inside `source`.
- **Fix:** Fix the JSON. In an inline array, write each quote inside `source` as `\"`.

---

## The bot data source is not a JSON array of rows

- **Symptom:** The cells start empty. The reason is `The bot data source is not a JSON array of rows.`
- **Cause:** The data parsed, but it is an object and not an array.
- **Fix:** Wrap the rows in `[` and `]`. Each row must be an object, such as `{ "User": "ann" }`.

---

## The bot file cannot be read (during a run)

- **Symptom:** A result is broken with the message `The bot file cannot be read: ...`.
- **Cause:** The bot file was missing or invalid when the run reached it.
- **Fix:** Restore the file and run again.

---

## The sheet says "No bot in the plan reads data"

- **Symptom:** The sheet shows `No bot in the plan reads data: add {{$ columns.Name }} placeholders to a bot to give it columns.`
- **Cause:** No bot of the plan has a placeholder. A placeholder with two spaces, no space, or a name with `-` is not found.
- **Fix:** Write the placeholder exactly as in [Module 1](01-make-a-bot-read-columns.md), inside the bot's rules.

---

## A column I added to a bot is not in the sheet

- **Symptom:** You added a placeholder, but no column appears.
- **Cause:** The sheet reads the bots when it opens. The placeholder may also be outside `stages`, or spelled with a different spacing.
- **Fix:** Save the bot, close the sheet, and open it again. Check the spacing.

---

## All iterations ran with the same values

- **Symptom:** Every iteration typed the same user.
- **Cause:** The rows were copied (**Add Iteration** and **Duplicate** copy values) and not changed.
- **Fix:** Change the values of each row. See [Module 2](02-fill-the-data-sheet.md).

---

[⬅ Back to overview](README.md)

Looking for a message that is not listed here? See the [Test Wright troubleshooting](../troubleshooting.md) page.
