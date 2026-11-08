# How to read run.json from a script

[⬅ Back to overview](README.md)

⏱️ **About 5 minutes**

---

## Goal

Read the result of a run from a script, list the bots that need attention, and stop a pipeline step when a run is not green.

## Before you start

- At least one finished run in the `reports` folder of your project.
- PowerShell 5.1 or later, or Node.js 18 or later. You only need one of them.

---

## Steps

### Step 1: Find the run

Every run is a folder in the `reports` folder of the project. The name is the start time, `yyyy-MM-dd-HHmmssfff`, so the newest run sorts last. Inside it, `run.json` holds the summary and one `.g4rpt` file per bot.

```text
reports/
    2026-11-08-101502123/
        run.json
        smoke.login.p1.g4rpt
        smoke.checkout.p2.g4rpt
    allure-2026-11-08-101502123/
```

The `reports` folder sits under the folder named by `clientReportSettings.reportsFolder` in `manifest.json`. When that key is empty, it sits in the project folder.

### Step 2: Know the fields

The file has `"type": "g4-test-wright-run"` and `"version": 1`.

| Field | What it holds |
| --- | --- |
| `name` | The run folder name |
| `label` | The label of a scheduled run, or an empty text |
| `scheduled` | `true` for a scheduled run |
| `startedAt`, `finishedAt` | UTC times in ISO form |
| `duration` | Milliseconds |
| `environment`, `engine` | The environment name and the engine address |
| `parallel` | Whether Parallel Tests was on |
| `iterations` | The number of iterations. Absent or 0 for a plan without iterations |
| `status` | The status of the run: `failed`, `broken`, `warning`, `canceled`, or `passed` |
| `tally` | `total`, `passed`, `failed`, `warning`, `broken`, and `canceled` |
| `tests` | One entry per bot execution |

Each entry of `tests` has:

| Field | What it holds |
| --- | --- |
| `id`, `name`, `suite`, `tags` | Which bot it is |
| `position` | The place of the row in the plan, starting at 1 |
| `iteration` | The iteration, starting at 1. 0 or absent without iterations |
| `values` | The data row that was sent. Absent for a bot without data |
| `status` | `passed`, `failed`, `warning`, `broken`, or `canceled` |
| `message` | The short reason. See [How to tell why a bot got its status](01-tell-why-a-bot-got-its-status.md) |
| `assertions` | `total` and `failed` |
| `exceptions` | How many different exception messages were reported |
| `start`, `stop`, `duration` | Epoch milliseconds, and milliseconds |
| `reportFile` | The `.g4rpt` file name, or an empty text when no answer was received |

### Step 3: List the bots that need attention

In PowerShell, from the project folder:

```powershell
$reports = Join-Path $PWD 'reports'
$latest = Get-ChildItem $reports -Directory |
    Where-Object { Test-Path (Join-Path $_.FullName 'run.json') } |
    Sort-Object Name |
    Select-Object -Last 1
$run = Get-Content (Join-Path $latest.FullName 'run.json') -Raw | ConvertFrom-Json

"Run $($run.name): $($run.status)"
$run.tally | Format-List

$run.tests |
    Where-Object { $_.status -ne 'passed' } |
    Select-Object status, id, iteration, message |
    Format-Table -AutoSize -Wrap
```

In Node.js:

```javascript
const fs = require('node:fs');
const path = require('node:path');

const reports = path.join(process.cwd(), 'reports');
const latest = fs.readdirSync(reports, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(reports, entry.name, 'run.json')))
    .map((entry) => entry.name)
    .sort()
    .pop();
const run = JSON.parse(fs.readFileSync(path.join(reports, latest, 'run.json'), 'utf8'));

console.log(`Run ${run.name}: ${run.status}`);
console.table(run.tally);
console.table(run.tests
    .filter((test) => test.status !== 'passed')
    .map((test) => ({ status: test.status, id: test.id, iteration: test.iteration ?? 0, message: test.message })));
```

### Step 4: Stop a pipeline when the run is not green

Add these lines to the end of the PowerShell script. They end the script with a non-zero exit code when a bot failed or is broken.

```powershell
if ($run.tally.failed -gt 0 -or $run.tally.broken -gt 0) {
    exit 1
}
```

In Node.js, set the exit code at the end:

```javascript
if (run.tally.failed > 0 || run.tally.broken > 0) {
    process.exitCode = 1;
}
```

**Warning** and **Canceled** do not fail the check above. Add them to the test if your pipeline must treat them as red.

### Step 5: Read the G4 report of a bot

A `.g4rpt` file is the answer of the engine, encoded in Base64. To read it in PowerShell:

```powershell
$bot = $run.tests | Where-Object { $_.reportFile -ne '' } | Select-Object -First 1
$encoded = Get-Content (Join-Path $latest.FullName $bot.reportFile) -Raw
$response = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($encoded.Trim())) | ConvertFrom-Json
$response | Get-Member -MemberType NoteProperty | Select-Object -First 5 Name
```

The answer is wrapped under the id of the automation. Its `sessions` hold the steps of the bot. The easiest way to read it is the G4 report viewer. See [Module 8 of Run Your Bots](../run-your-bots/08-read-the-results.md).

---

## Verify

Run the PowerShell script on a project with a run that has a failed bot.

- It prints `Run <name>: failed` and the tally.
- The table lists the failed bot with its message.
- The exit code is 1. Check it with `echo $LASTEXITCODE` in the same session after running the script as a file.

## If it fails

| What you see | Why | What to do |
| --- | --- | --- |
| `Cannot find path ... reports` | You ran the script outside the project folder, or the reports folder is elsewhere | Run it from the folder that holds `reports`, or set `$reports` to the right path. |
| The newest folder has no `run.json` | The run is still going. `run.json` is written when the run ends | Wait for the run to finish. The script above skips folders without it. |
| `tests` is empty | The run was stopped before any bot started | Run again. |
| A bot has no `reportFile` | The engine did not answer for that bot | Read its `message`. See [How to read an engine error](03-read-an-engine-error.md). |

---

**Need more help?** See [Troubleshooting](troubleshooting.md).
