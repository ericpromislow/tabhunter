# Changelog

All notable changes to Tabhunter are documented in this file.

## [Unreleased]

- Placeholder for upcoming changes

## [3.6.9] - 2025-09-25

- Added support for searching URLs in non-Latin languages without requiring punycode

## [3.6.8] - 2024-12-11

- Changed `URL+Title` copy formatting to separate the two parts with `|` instead of a hyphen

## [3.6.7] - 2024-11-11

- Added `{!:}` as a pattern prefix to negate matches and hide tabs that match the pattern

## [3.6.2] - 2024-04-17

- Housekeeping release with no noticeable user-facing changes

## [3.6.0] - 2024-03-15

- Improved the window-and-tab-order sorting workflow
- Moved the sort option closer to the top of the preferences screen
- Displayed the current window number when sorting by window and tab order to make duplicate-tab cleanup easier

## [3.5.2] - 2023-03-18

- Reverted the `Backspace` and `Delete` tab-closing behaviour from `3.5.0`
- Restored normal deletion behaviour in input fields
- Left those keys with no special action outside supported input contexts

## [3.5.1] - 2023-03-16

- No visible changes from `3.5.0`

## [3.5.0] - 2023-03-15

- Added keyboard support for closing selected tabs with `Backspace` or `Delete`

## [3.4.0]

- Migrated the extension to Chrome Manifest V3

## [3.3.0] - 2021-03-23

- Avoided calling the post-search callback when it is unset
- Preserved maximized and fullscreen window state instead of restoring those windows to normal size

## [3.2.4] - 2020-07-05

- Reworked large-tab handling to stay responsive with very large tab counts
- Kept initial list population synchronous for the first 100 entries, then appended the remainder asynchronously so pattern edits stay responsive

## [3.2.3] - 2020-07-03

- Improved asynchronous list building for large tab sets
- Allowed matching and list construction to be interrupted when the pattern changes
- Improved responsiveness when working with around 1000 or more tabs

## [3.2.2] - 2020-07-02

- Delayed pattern processing when more than 1000 tabs are loaded to improve responsiveness
- Scaled the delay with the number of loaded tabs
- Prevented pattern edits while delayed processing is running

## [3.2.0] - 2020-07-02

- Added simple dark-mode styling for dark browser themes
- Switched most text to light colours and backgrounds to dark greys or black when theme text colours indicate dark mode

## [3.1.2] - 2020-07-01

- Changed the `Select All` shortcut to `Shift-Ctrl-A`
- Avoided conflicts with selecting all text in the pattern field and with the macOS Add-ons shortcut

## [3.1.1] - 2020-07-01

- Added support for reloading selected tabs
- Exposed the `Reload` button in the `More...` panel alongside the activate and deactivate actions

## [3.1.0] - 2020-06-30

- Added `Select All`
- Added a `Select All` button
- Added keyboard support for selecting all matched tabs with `Ctrl-A` and `Cmd-A` on macOS

## [3.0.5] - 2019-05-23

- Reissued the add-on after downloads broke, likely because version `3.0.4` had been signed with an expired certificate
- No functional add-on changes

## [3.0.4] - 2018-09-07

- Kept the current row scrolled into view when moving through the list with the up and down arrow keys

## [3.0.3] - 2018-06-16

- Clarified in the UI that the main pattern field is read-only while searching inside tabs
- Added a green fade effect for in-tab text matches

## [3.0.1] - 2018-06-13

- Updated the matched-tab list incrementally while in-tab searching runs
- Added `regex:` and `xpath:` prefixes for text-search patterns to reduce false positives and disambiguate XPath expressions

## [3.0.0] - 2018-06-12

- Restored searching inside loaded tabs
- Limited in-tab searching to loaded, non-`about:` tabs
- Added a secondary pattern field behind the `Search text in tabs` action
- Supported plain text, JavaScript regular expressions, and XPath expressions for in-tab searching

## [2.2.7] - 2018-06-06

- Restored preferences on the add-on page

## [2.2.6] - 2018-06-04

- Added tab-closing animation

## [2.2.5] - 2018-06-02

- Disabled drag-and-drop in reverse mode
- Improved resilience when dragging tabs forward

## [2.2.4] - 2018-06-01

- Changed the default startup shortcuts to:
  - macOS: `Shift-Ctrl-T`
  - Linux: `Ctrl-5`
  - Windows: `Shift-Ctrl-S`
- Documented that shortcuts may still depend on the browser's current keybinding configuration and can be changed in preferences

## [2.2.2]

- Added drag-and-drop support when tabs are sorted by window and tab position

## [2.2.0]

- Made preferences available directly in the main window via the `More...` button
- Updated preference changes to apply immediately instead of waiting for `Submit`

## [2.1.7]

- Added window-scoped pattern prefixes for numeric sub-selection:
  - `{w:N}` limits matches to window `N`
  - `{w:N:T1-T2}` limits matches to tabs `T1` through `T2` in window `N`
  - `{w:N:T}` limits matches to tab `T` through the end of window `N`
  - `{w:N:-T}` limits matches to tabs `1` through `T` in window `N`

## [2.1.6]

- Added support for moving a group of tabs to a selected window

