# Changelog

All notable user-visible changes to G4 Studio Test Wright are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2026.11.14

### Added

- Unit tests for the reporting code run with `npm run test:unit` and in the release pipeline. They check the status
  and the Allure steps of responses with Parallel containers and Input Actions Groups.

### Changed

- The README describes the build and test commands instead of linking to a guide outside the repository.

## Earlier releases

These changes shipped in the releases up to 2026.11.13. The commit in parentheses identifies each one.

### Added

- Practice bots and environments for the Test Wright learning paths (0108674).
- Allure reports are kept off the network (air gap) (b3e3862).
- The extension runs fully in untrusted folders (fcf1535).
- Runs are logged to the output channel (e31d130).
- Plan adds and clears are logged (603c9ed).

### Changed

- The panel explains why the engine cannot be reached (5f2735f).
- The engine chip is checked again when the engine address changes (4137582).
- Items canceled before they start are reported (e31d130).
- New Test Wright tabs take the lowest free number (776af99).

### Fixed

- A bot that runs its own multi-row `dataSource` is reported as one test per data row, in the panel, the run
  report, `run.json`, and Allure, instead of one test with its steps repeated per row.
- A scheduled run now runs in the repeated hour of a daylight-saving fall-back (a2df45e).
- The bot name stays visible in narrow plan rows (954e378).
- Open panels follow a changed Reports Folder (f2a70de).
- Iterations are cleared together with the plan (603c9ed).
