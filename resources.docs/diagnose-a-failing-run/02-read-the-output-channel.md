# How to read the output channel

[⬅ Back to overview](README.md)

⏱️ **About 6 minutes**

---

## Goal

Open the log that Test Wright writes in VS Code, understand one entry, and raise or lower the log level.

## Before you start

- Test Wright is open in a G4 project.
- You can edit the `manifest.json` of the project.

---

## Steps

### Step 1: Open the output channel

1. Open the **Output** panel: **View → Output**, or `Ctrl+Shift+U`.
2. In the drop-down at the right of the panel, pick **G4 Test Wright**.

![The G4 Test Wright output channel](images/02-output-channel.png)

TODO(screenshot): images/02-output-channel.png - the Output panel with G4 Test Wright selected and a few entries of a run.

The channel uses the `g4log` language, so levels and names are colored.

> **📝 Note:** The Test Wright console on the page and this channel are different. The console shows the lines of the runs started from that tab. The channel also holds the lines of scheduled runs, the problems of the extension itself, and errors with their stack.

### Step 2: Read one entry

Every entry has the same lines:

```text
timestamp:   08/11/26, 10:15:02.123
level:       i INFORMATION
application: G4 Test Wright
logger:      G4.TestWright.RunService
message:     Starting run 2026-11-08-101502123: 3 plan item(s) on http://localhost:9944.
```

| Line | What it tells you |
| --- | --- |
| `level` | How serious the entry is. See Step 4. |
| `logger` | Which part of the extension wrote it. See the list below. |
| `message` | The text. For a run, it is the same text as the console line. |
| `reason` | Appears only for entries that carry an event code. |
| `# ERROR` block | Appears when the entry has an error. It holds the stack. |

The loggers you will meet:

| Logger | Writes about |
| --- | --- |
| `G4.TestWright` | Start-up: the engine address and the project folder |
| `G4.TestWright.RunService` | Every run: start, each bot, summary, report path, and run failures |
| `G4.TestWright.Scheduler` | Scheduled runs that were queued or dropped |
| `G4.TestWright.AllureReport` | The output of the Allure command |
| `G4.TestWright.RunReport` | Problems opening a run report |
| `G4.TestWright.Panel` | Lines the page sends to the host, and failed page requests |

### Step 3: Find the line you need

Each bot of a run leaves these lines in the channel:

- `RUN   <bot>` when the bot starts
- `PASSED`, `FAILED`, `WARNING`, `BROKEN`, or `CANCELED` with the bot, its time, and its message
- `Run <name> finished in <seconds>s: ...` with the counts
- `Report: <path>` with the `run.json` of the run

`FAILED`, `BROKEN`, and `WARNING` lines are written at the **warning** level. A failed bot is a result of a test, not an error of the extension, so it is never written as an error.

A real problem of the extension is written at the **error** level. Two examples:

- `Run <name> failed.` when the run itself stopped with an exception
- `Bot <bot> failed.` when one bot's report could not be saved

### Step 4: Change the log level

The level comes from `manifest.json`. Add this under `settings`:

```json
{
    "settings": {
        "clientLogConfiguration": {
            "logLevel": "information",
            "sourceOptions": {
                "filter": "include",
                "sources": []
            }
        }
    }
}
```

| Key | Values | What it does |
| --- | --- | --- |
| `logLevel` | `none`, `trace`, `debug`, `information`, `warning`, `error`, `fatal` | The lowest level that is written. A level also writes every more serious level. `none` writes nothing. |
| `sourceOptions.filter` | `include` or `exclude` | Whether the `sources` list is the only loggers written, or the loggers left out. |
| `sourceOptions.sources` | A list of logger names, such as `G4.TestWright.RunService` | The loggers the filter works on. An empty list writes every logger. Names are not case sensitive. |

If the manifest has no log settings, or no `logLevel`, the level is `information`.

**Which key is read?** Test Wright reads `settings.clientLogSettings` first. When that key is absent, it reads `settings.clientLogConfiguration`, the key G4 Studio's Settings Editor writes. Keep only one of them: when both exist, `clientLogSettings` wins.

> **💡 Tip:** Today the extension writes **information**, **warning**, and **error** entries only. It has no **debug** or **trace** entries, so those two levels show the same lines as **information**. Use **warning** to hide the normal run lines and keep the failed bots.

TODO(verify): the extension rebuilds its logger when you save `manifest.json`, but the services that were created at start-up keep their first logger. Reload the window (**Developer: Reload Window**) after a level change to be sure it reaches the run lines. This was read from code (`src/extension.ts`, `src/constants/global.ts`), not tested.

---

## Verify

1. Set `logLevel` to `warning`, save, and reload the window.
2. Run **practice-pass** and **practice-fail**.
3. In the channel, the `RUN` and `PASSED` lines are gone. The `FAILED` line is still there.
4. Set `logLevel` back to `information` and reload. The lines come back.

## If it fails

| What you see | Why | What to do |
| --- | --- | --- |
| The channel list has no **G4 Test Wright** | The extension has not started yet | Open Test Wright once. The channel is created at start-up. |
| The channel is empty | `logLevel` is `none`, or the `sources` filter leaves every logger out | Set `logLevel` to `information` and clear `sources`. |
| Nothing changes after you edit the level | The manifest is not valid JSON, or the key is under the wrong object | Check that the keys sit under `settings`, and reload the window. |
| The level you set is ignored | Both `clientLogSettings` and `clientLogConfiguration` are in the manifest | Remove `clientLogSettings`, or edit it instead. `clientLogSettings` wins when both are present. |

---

**Next up** 👉 [How to read an engine error](03-read-an-engine-error.md)
