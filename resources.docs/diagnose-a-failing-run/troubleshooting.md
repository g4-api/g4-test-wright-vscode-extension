# Troubleshooting: Diagnose a Failing Run

[⬅ Back to overview](README.md)

Find your symptom below. Each entry says what you see, why it happens, and what to do. Messages are shown exactly as Test Wright writes them.

---

## A bot is Broken with "Engine unreachable at ..."

- **Symptom:** The row, the console, and the Run Report show `Engine unreachable at http://localhost:9944: ...`.
- **Cause:** The request did not reach the engine, or the link broke while the bot ran.
- **Fix:** Start the engine and check `g4Server` in `manifest.json`. Read the reason after the colon. See [How to read an engine error](03-read-an-engine-error.md).

---

## A bot is Broken with "HTTP ..."

- **Symptom:** The message looks like `HTTP 400 Bad Request: ...`.
- **Cause:** The engine answered, but with an error code. The text after the colon is the start of its answer.
- **Fix:** Read that text first. Then check the bot in the Workflow Editor. See [How to read an engine error](03-read-an-engine-error.md).

---

## A bot is Broken with "The engine answered with invalid JSON"

- **Symptom:** The message is `The engine answered with invalid JSON: ...` followed by the start of the answer.
- **Cause:** The address answers with something that is not the G4 engine, such as a proxy page.
- **Fix:** Open the address from `g4Server` in a browser. Fix the host or the port. See [How to read an engine error](03-read-an-engine-error.md).

---

## A bot is Broken with "The engine response holds no automation session."

- **Symptom:** The engine answered with JSON, but the bot did not run.
- **Cause:** The answer has no session, so the automation never started.
- **Fix:** Check the `driverParameters` of the bot, and read the engine log. See [How to tell why a bot got its status](01-tell-why-a-bot-got-its-status.md).

---

## A bot is Broken and has no G4 report

- **Symptom:** You click the bot in the Run Report and VS Code says `No G4 report was saved for '<bot>' (it did not get an engine response).`
- **Cause:** The engine did not answer for this bot, so there was nothing to save.
- **Fix:** Use the message of the bot. See [How to read an engine error](03-read-an-engine-error.md).

---

## A bot passes, but it should fail

- **Symptom:** The status is **Passed** and you expected **Failed**.
- **Cause:** The bot has no **Assert** step, or its check compares two equal values. Only a check that is not true gives **Failed**.
- **Fix:** Open the G4 report and look for the **Assert** step. See [How to tell why a bot got its status](01-tell-why-a-bot-got-its-status.md).

---

## The Output panel has no "G4 Test Wright" entry

- **Symptom:** The drop-down of the Output panel does not list the channel.
- **Cause:** The extension has not started yet.
- **Fix:** Open Test Wright once. See [How to read the output channel](02-read-the-output-channel.md).

---

## The log level does not change

- **Symptom:** You edited `logLevel` and the channel looks the same.
- **Cause:** The keys are not under `settings`, the file is not valid JSON, or both `clientLogSettings` and `clientLogConfiguration` are in the manifest. `clientLogSettings` wins and `clientLogConfiguration` is ignored. The services that started with the window also keep their first logger.
- **Fix:** Keep only one of `settings.clientLogSettings` and `settings.clientLogConfiguration`, then run **Developer: Reload Window**. See [How to read the output channel](02-read-the-output-channel.md).

---

## The console says an environment was not synced

- **Symptom:** A yellow line starts with `Environment '<name>' was not synced` or `Environment '<name>' cannot be read`.
- **Cause:** The file name has characters other than letters, digits, and `_`, the file is not a JSON object, or the upload failed.
- **Fix:** Rename or fix the file. The bots still run, but they may fail on missing values. See [How to read an engine error](03-read-an-engine-error.md).

---

## The rerun uses other values

- **Symptom:** A bot you loaded from a run passes or fails differently than before.
- **Cause:** Dragging a run onto the plan loads its bots, not its environment.
- **Fix:** Pick the environment of the failed run in the header. See [How to rerun one bot](04-rerun-one-bot.md).

---

## My script cannot find run.json

- **Symptom:** The script says it cannot find the path, or the newest folder has no `run.json`.
- **Cause:** You ran it outside the project folder, or the run is still going. `run.json` is written when the run ends.
- **Fix:** Run the script from the folder that holds `reports`, and wait for the run to end. See [How to read run.json from a script](05-read-run-json-from-a-script.md).

---

**Still stuck?** See the [Run Your Bots troubleshooting](../run-your-bots/troubleshooting.md).

Looking for a message that is not listed here? See the [Test Wright troubleshooting](../troubleshooting.md) page.
