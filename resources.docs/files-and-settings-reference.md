# Files and Settings Reference: G4 Studio Test Wright

This page lists every file Test Wright reads or writes, and every manifest key it uses. Each table ends with the file and line where the behaviour is written, so you can check it against the code.

Shared manifest keys (the engine address, authentication, driver parameters, engine settings) are explained in the G4 Studio manifest guide. This page covers only what is specific to Test Wright. See the Configure Your Manifest path in G4 Studio for the shared keys.

## Where Test Wright looks

| Item | Location | Notes | Source |
| --- | --- | --- | --- |
| Workspace folder | The first folder of the VS Code workspace | Other folders of a multi-root workspace are ignored | `src/extensions/utilities.ts:218` |
| Project folder | `<workspace>\src` when that holds `manifest.json` and the workspace folder does not; otherwise the workspace folder | Same rule as G4 Studio | `src/extensions/utilities.ts:164` |
| Manifest | `<project>\manifest.json` | Read once and cached; an invalid file counts as no manifest | `src/extensions/utilities.ts:296` |
| Bots | `<project>\bots` | Searched recursively | `src/extensions/utilities.ts:57` |
| Environments | `<project>\environments` | Top level only | `src/extensions/utilities.ts:91`, `src/services/bots-discovery-service.ts:79` |
| Plans | `<project>\.repositories` | Plan files and data files you save there | `src/extensions/utilities.ts:150` |
| Reports | `<reportsFolder>\reports` | `reportsFolder` is relative to the project folder and defaults to `.` | `src/extensions/utilities.ts:193` |
| Reports without a project | `%TEMP%\g4-test-wright\reports` | Used when no workspace folder is open, so there is no reports folder | `src/services/run-service.ts:264` |

## Limits

| Limit | What happens | Source |
| --- | --- | --- |
| First workspace folder only | Bots, environments, plans and reports of the other folders are not seen | `src/extensions/utilities.ts:218` |
| Bot scan skips hidden folders, `node_modules` and `reports` | A bot inside any of them is not listed | `src/services/bots-discovery-service.ts:20, 153` |
| Bot files are `.json`, `.g4` and `.g4bot` that parse as JSON and hold a `stages` array | Other files are skipped and named in a warning | `src/services/bots-discovery-service.ts:13, 53-60` |
| Plan and report scans go at most 6 folders deep | Files deeper than that are not listed | `src/services/repository-service.ts:17, 134` |
| Plan and report scans skip `node_modules` and folders that start with `allure-` | Allure output is never searched for plans or run records | `src/services/repository-service.ts:152` |
| Environment names are letters, digits and `_` only | A file with another name is listed with an issue and is not synced | `src/services/bots-discovery-service.ts:17, 94-96` |
| Plans and reports folders are created only in a G4 project | Without a `manifest.json`, Test Wright creates no folder | `src/extensions/utilities.ts:234` |

## Manifest keys Test Wright reads

Test Wright reads the project `manifest.json`. It has no settings of its own in VS Code and registers no configuration section.

| Key | Default | Where it is read | What it does |
| --- | --- | --- | --- |
| `g4Server.host` | none | `src/extensions/utilities.ts:70-79` | Engine host. Without it, Test Wright uses `http://localhost:9944` |
| `g4Server.schema` | `http` | `src/extensions/utilities.ts:77` | Engine schema |
| `g4Server.port` | none | `src/extensions/utilities.ts:78` | Engine port, added as `:<port>` when set |
| `authentication.token` | none | `src/services/bot-request-builder.ts:41-45` | When it is a non-empty text, it replaces the token of every bot |
| `authentication` (other keys) | none | `src/services/bot-request-builder.ts:39` | Fills only the keys a bot leaves out |
| `driverParameters` | none | `src/services/bot-request-builder.ts:47` | Fills only the keys a bot leaves out, recursively |
| `settings` (engine sections) | none | `src/services/bot-request-builder.ts:48` | Fills only the keys a bot leaves out, recursively |
| `settings.clientLogSettings.logLevel` | `information` | `src/extensions/utilities.ts:101-108` | Level of the "G4 Test Wright" output channel |
| `settings.clientLogSettings.sourceOptions` | `{ "filter": "include", "sources": [] }` | `src/extensions/utilities.ts:105` | Which logger names are written |
| `settings.clientLogConfiguration` | none | `src/extensions/utilities.ts:101` | The name G4 Studio's Settings Editor writes. It is read only when `clientLogSettings` is absent |
| `settings.clientReportSettings.reportsFolder` | `.` | `src/extensions/utilities.ts:193` | Parent of the `reports` folder, relative to the project folder |

### The merge rule

Test Wright builds one request per bot from the bot file and the manifest.

| Rule | Detail | Source |
| --- | --- | --- |
| The bot wins | For `authentication`, `driverParameters` and `settings`, a value in the bot is never replaced. The manifest fills only the keys the bot leaves out, and it does so recursively into objects | `src/services/bot-request-builder.ts:70-87` |
| The manifest token wins | A non-empty `authentication.token` in the manifest replaces the bot token | `src/services/bot-request-builder.ts:41-45` |
| Arrays are not merged | An array in the bot is kept as it is | `src/services/bot-request-builder.ts:75-78` |
| Client-only settings are never sent | `clientLogConfiguration`, `clientLogSettings`, `clientReportSettings`, `recorderSettings` and `queueManagerSettings` are removed from the manifest settings before the merge | `src/services/bot-request-builder.ts:14-20, 92-98` |
| A selected environment is added | `settings.environmentsSettings.defaultEnvironment` is set to the environment name | `src/services/bot-request-builder.ts:52-57` |

A manifest that holds both `clientLogSettings` and `clientLogConfiguration` uses `clientLogSettings`. Keep only one of them.

## Engine calls

| Call | Used for | Timeout | Source |
| --- | --- | --- | --- |
| `GET /api/v4/g4/ping` | Checks that the engine answers | 3 seconds | `src/clients/g4-client.ts:86` |
| `POST /api/v4/g4/automation/invoke` | Runs one bot | None (the engine answers when the bot finishes) | `src/clients/g4-client.ts:55` |
| `PUT /api/v4/g4/environments/<name>?encode=true` | Uploads the selected environment before a run | 10 seconds | `src/clients/g4-client.ts:108-112` |

## Bot file

A bot is a G4 automation request. Test Wright adds nothing to it. It uses two parts for its own purposes.

| Field | Used for | Source |
| --- | --- | --- |
| `stages` | A file without a `stages` array is not a bot | `src/services/bots-discovery-service.ts:53` |
| `reference.tags` | Tags shown in the tree and written as Allure labels. Empty or non-text entries are dropped | `src/services/bots-discovery-service.ts:172-174` |

## Plan file (`g4-test-wright-plan`)

You save a plan from the plan toolbar. Version 2 is what Test Wright writes today. Version 1 files still load, as plans without iterations.

| Field | Type | Meaning | Source |
| --- | --- | --- | --- |
| `type` | text | Always `g4-test-wright-plan`. A file with another value is not listed | `src/services/repository-service.ts:11, 96` |
| `version` | number | `2` when written; `1` or `2` when read | `resources.components/test-wright/modules/test-wright-plan-files.js:11`, `src/models/test-wright-models.ts:334` |
| `savedAt` | text | ISO date-time. The plan list sorts by it, newest first | `src/services/repository-service.ts:47` |
| `folderPath` | text | The bots root the plan was built from | `src/models/test-wright-models.ts:336` |
| `parallel` | true or false | Run bots at the same time | `src/models/test-wright-models.ts:337` |
| `iterations` | array | One `{ "include": true or false }` per iteration. Absent or empty runs the suite once | `src/models/test-wright-models.ts:320-322, 340` |
| `items` | array | The plan rows, in order. Required, or the file is not a plan | `src/services/repository-service.ts:96` |

Each entry of `items`:

| Field | Type | Meaning | Source |
| --- | --- | --- | --- |
| `key` | text | Stable key of the row. Absent in version 1 files; the page then creates one | `src/models/test-wright-models.ts:304` |
| `testId` | text | Bot id: its path below the bots root, with forward slashes | `src/models/test-wright-models.ts:305` |
| `name` | text | Bot name (file name without extension) | `src/models/test-wright-models.ts:306` |
| `file` | text | Same as `testId` | `src/models/test-wright-models.ts:307` |
| `suite` | text | Folder of the bot below the bots root | `src/models/test-wright-models.ts:308` |
| `tags` | array of text | Bot tags | `src/models/test-wright-models.ts:309` |
| `checked` | true or false | Whether the row is selected | `src/models/test-wright-models.ts:310` |
| `folder` | text | The folder the row came from | `src/models/test-wright-models.ts:311` |
| `data` | array of objects | One object of column name to text value per iteration. Absent or empty for a bot without columns | `src/models/test-wright-models.ts:314` |

```json
{
    "type": "g4-test-wright-plan",
    "version": 2,
    "savedAt": "2026-11-08T09:30:00.000Z",
    "folderPath": "bots",
    "parallel": false,
    "iterations": [
        { "include": true },
        { "include": false }
    ],
    "items": [
        {
            "key": "k1",
            "testId": "practice/login-with-columns.json",
            "name": "login-with-columns",
            "file": "practice/login-with-columns.json",
            "suite": "practice",
            "tags": ["data"],
            "checked": true,
            "folder": "practice",
            "data": [
                { "User": "alice", "Password": "one" },
                { "User": "bob", "Password": "two" }
            ]
        }
    ]
}
```

## Data file (`g4-test-wright-data`)

You export a data file from the iterations sheet and import it into another plan.

| Field | Type | Meaning | Source |
| --- | --- | --- | --- |
| `type` | text | Always `g4-test-wright-data` | `resources.components/test-wright/modules/test-wright-data.js:21` |
| `version` | number | Always `1` | `resources.components/test-wright/modules/test-wright-data.js:22` |
| `savedAt` | text | ISO date-time of the export | `resources.components/test-wright/modules/test-wright-data.js:420` |
| `iterations` | array | One entry per plan iteration | `src/models/test-wright-models.ts:367` |
| `iterations[].include` | true or false | Whether the iteration runs | `src/models/test-wright-models.ts:375` |
| `iterations[].items` | object | Values of each plan row, by row `key`. Rows without columns are left out | `resources.components/test-wright/modules/test-wright-data.js:402-408` |
| `items.<key>.position` | number | One-based position of the row in the plan | `src/models/test-wright-models.ts:386` |
| `items.<key>.testId` | text | Bot id | `src/models/test-wright-models.ts:389` |
| `items.<key>.values` | object | Column name to text value | `src/models/test-wright-models.ts:392` |

The default file name is `g4-data-<time>.json`, where the time has `:` and `.` replaced by `-` (`resources.components/test-wright/modules/test-wright-data.js:421-422`).

```json
{
    "type": "g4-test-wright-data",
    "version": 1,
    "savedAt": "2026-11-08T09:30:00.000Z",
    "iterations": [
        {
            "include": true,
            "items": {
                "k1": {
                    "position": 1,
                    "testId": "practice/login-with-columns.json",
                    "values": { "User": "alice", "Password": "one" }
                }
            }
        }
    ]
}
```

## Environment file

| Rule | Detail | Source |
| --- | --- | --- |
| Location | `<project>\environments\<name>.json`, top level only | `src/services/bots-discovery-service.ts:79-92` |
| Name | The file name without `.json`. Letters, digits and `_` only | `src/services/bots-discovery-service.ts:17` |
| Content | One JSON object of parameter names and values. Anything else is listed with an issue and cannot be chosen | `src/services/bots-discovery-service.ts:101-106` |
| Upload | Sent to the engine before the run as text values: a text stays as it is, `null` becomes an empty text, an object becomes JSON text, any other value becomes its text form | `src/clients/g4-client.ts:122-135` |
| Failure | A failed upload is a warning in the console; the run continues with the engine copy, if there is one | `src/services/run-service.ts:384-407` |

```json
{
    "BaseUrl": "https://staging.example.com",
    "User": "tester",
    "Retries": 3
}
```

## Run folder and `run.json`

Every run writes one folder named `yyyyMMdd-HHmmss` under the reports folder (`src/extensions/utilities.ts:248`). When two runs start in the same second, the second gets `-2`, the next `-3`, and so on (`src/services/run-service.ts:263-276`).

```text
reports/
    20261108-093000/
        run.json
        smoke.login.g4rpt
        smoke.login.p2.i1.g4rpt
    20261108-093000-allure/
        results/
        report/
    allure-merged/
```

### `run.json` (`g4-test-wright-run`)

| Field | Type | Meaning | Source |
| --- | --- | --- | --- |
| `type` | text | Always `g4-test-wright-run`. A file with another value is not listed | `src/services/run-service.ts:175`, `src/services/repository-service.ts:113` |
| `version` | number | Always `1` | `src/services/run-service.ts:176` |
| `name` | text | The run folder name | `src/services/run-service.ts:177` |
| `label` | text | Schedule label, or an empty text | `src/services/run-service.ts:178` |
| `scheduled` | true or false | True when a schedule started the run | `src/services/run-service.ts:179` |
| `startedAt`, `finishedAt` | text | ISO date-times | `src/services/run-service.ts:180-181` |
| `duration` | number | Milliseconds | `src/services/run-service.ts:182` |
| `environment` | text | Selected environment, or an empty text | `src/services/run-service.ts:183` |
| `engine` | text | Engine address the run used | `src/services/run-service.ts:184` |
| `botsFolder` | text | The bots root | `src/services/run-service.ts:185` |
| `parallel` | true or false | Whether bots ran at the same time | `src/services/run-service.ts:186` |
| `iterations` | number | Number of iterations; `0` when the plan had none | `src/services/run-service.ts:187` |
| `status` | text | Status of the whole run | `src/services/run-service.ts:188` |
| `tally` | object | Counts per status (see below) | `src/services/run-service.ts:189` |
| `tests` | array | One record per bot execution (see below) | `src/services/run-service.ts:190` |

`tally` holds `total`, `passed`, `failed`, `warning`, `broken` and `canceled` (`src/services/run-service.ts:535-537`).

Each entry of `tests`:

| Field | Type | Meaning | Source |
| --- | --- | --- | --- |
| `runKey` | text | The row key, plus `@<iteration>` when the plan has iterations | `src/models/test-wright-models.ts:210` |
| `key` | text | Plan row key | `src/models/test-wright-models.ts:213` |
| `position` | number | One-based position in the plan | `src/models/test-wright-models.ts:219` |
| `iteration` | number | One-based iteration; `0` when the plan had none | `src/models/test-wright-models.ts:219` |
| `values` | object | The data row sent; absent for a bot without columns | `src/models/test-wright-models.ts:222` |
| `id`, `name`, `file`, `path`, `suite`, `tags` | text and array | The bot | `src/models/test-wright-models.ts:224-229` |
| `status` | text | One of `not-run`, `queued`, `running`, `passed`, `failed`, `warning`, `broken`, `canceled` | `src/models/test-wright-models.ts:19` |
| `start`, `stop`, `duration` | number | Epoch milliseconds, and milliseconds | `src/models/test-wright-models.ts:233-239` |
| `reportFile` | text | Name of the `.g4rpt` file in the run folder; empty when the engine sent no response | `src/models/test-wright-models.ts:242` |
| `message` | text | First failed assertion, first exception, or the transport error | `src/models/test-wright-models.ts:245` |
| `assertions` | object | `{ "total": n, "failed": n }` | `src/models/test-wright-models.ts:248` |
| `exceptions` | number | Number of plugin and session exceptions | `src/models/test-wright-models.ts:251` |

### `.g4rpt` report

One file per bot execution, in the run folder. It holds the Base64 text of the engine response JSON, the same format G4 Studio saves (`src/services/run-service.ts:348`). The name is the bot id without its extension, with `/` replaced by `.`, then `.p<position>` and `.i<iteration>` when they apply. A repeated name gets `-2`, `-3` and so on (`src/services/run-service.ts:515-530`).

## Allure results layout

When **Collect** is on, the run writes Allure results next to the run folder.

| Path | Content | Source |
| --- | --- | --- |
| `<run>-allure/results/<uuid>-result.json` | One Allure test result per bot execution | `src/services/allure-converter.ts:223` |
| `<run>-allure/results/<uuid>-container.json` | The run container, named by the label or the run name | `src/services/allure-converter.ts:236-245` |
| `<run>-allure/results/<uuid>-attachment.<ext>` | Attachments: the `g4-response` JSON, assertion entities, exceptions and screenshots | `src/services/allure-converter.ts:220, 416, 450, 505` |
| `<run>-allure/results/environment.properties` | `Run`, `Environment`, `Engine`, `Bots.Folder`, `Parallel` and `Scheduled` | `src/services/allure-converter.ts:247-257` |
| `<run>-allure/results/executor.json` | The executor name `G4 Studio Test Wright` and the build and report names | `src/services/allure-converter.ts:259-265` |
| `<run>-allure/results/categories.json` | The four categories | `src/services/allure-converter.ts:36-41, 268` |
| `<run>-allure/report/` | The generated report | `src/services/allure-converter.ts:20-21` |
| `allure-merged/` | A report merged from several runs | `src/services/allure-converter.ts:22, 47` |

A new conversion deletes the old results folder of that run first, so results are never doubled (`src/services/allure-converter.ts:113`). For parameters, labels and categories, see [Allure in Depth](allure-in-depth/README.md).

## What Test Wright does not do

| Not supported | Detail |
| --- | --- |
| VS Code Testing API | Test Wright has its own panel and tree. A search of `src` finds no use of the Testing API |
| Command line | The extension has only `main: ./dist/extension.js` and no `bin` entry in `package.json` (`package.json:38`). Runs start from the panel or a schedule |
| Several workspace folders | Only the first one is used |

Back to the [Test Wright learning paths](test-wright-learning.md).
