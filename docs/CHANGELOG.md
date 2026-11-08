# Changelog

All notable user-visible changes to G4 Studio Test Wright are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

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

- A scheduled run now runs in the repeated hour of a daylight-saving fall-back (a2df45e).
- The bot name stays visible in narrow plan rows (954e378).
- Open panels follow a changed Reports Folder (f2a70de).
- Iterations are cleared together with the plan (603c9ed).
