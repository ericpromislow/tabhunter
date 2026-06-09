# Tabhunter

Tabhunter helps you find, switch, and manage tabs across many browser windows.

Originally inspired by the classic Firefox extension of the same name, Tabhunter is built for people who regularly work with large numbers of tabs and want faster ways to search, select, and act on them.

## Install

- Firefox Add-ons: https://addons.mozilla.org/en-GB/firefox/addon/tabhunter/
- Chrome Web Store: https://chromewebstore.google.com/detail/tabhunter/kdbjnnjfgmbhoaggihfgnlfnfhhadmbn

## What it does

Tabhunter opens a popup that lets you search your open tabs, inspect the current match, and act on one or many tabs at once.

Core capabilities include:

- search tabs by title or URL
- switch to a matched tab with the keyboard or mouse
- bring forward tabs from minimized windows
- select multiple matched tabs for bulk actions
- close, reload, activate, discard, or move selected tabs
- copy a tab's URL, title, or `URL | Title`
- filter to audio-playing tabs with `Audio Only`
- sort by title, URL, or window/tab order
- reverse the current sort order
- search inside loaded tabs by plain text, regular expression, or XPath
- narrow matches to a specific window or tab range
- negate a pattern to hide matching tabs
- stay responsive even with very large numbers of open tabs

## Opening Tabhunter

Use the browser action button or the default keyboard shortcut for your platform:

- macOS: `Ctrl-Shift-T`
- Linux: `Ctrl-5`
- Windows: `Ctrl-Shift-S`

These defaults can still depend on browser-level shortcut availability and configuration.

## How to use it

### Find and switch tabs

1. Open Tabhunter
2. Type a pattern in the main `Pattern` field
3. Move through the results
4. Press Return, double-click a result, or use `Go` to switch to the selected tab

### Work with multiple tabs

You can select more than one result and then use the available actions to manage them together.

Common bulk actions include:

- `Close Tab`
- `Reload`
- `Activate Tabs`
- `Discard Tabs`
- `Move the Tabs`
- copy URL or title information

### Search inside tabs

Use `Search Text in Tabs ...` to search the contents of loaded tabs.

This supports:

- plain text
- JavaScript regular expressions
- XPath expressions

If you want to force a text-search mode, prefix the search with:

- `regex:`
- `xpath:`

While a text search is running, Tabhunter shows progress and provides `Pause` and `Cancel` controls.

### Filter audio tabs

Enable `Audio Only` to focus on tabs that are currently playing audio.

### Restrict matches to a window or tab range

You can prefix the main pattern with window selectors:

- `{w:N}` limits matches to window `N`
- `{w:N:T1-T2}` limits matches to tabs `T1` through `T2` in window `N`
- `{w:N:T}` limits matches to tab `T` through the end of window `N`
- `{w:N:-T}` limits matches to tabs `1` through `T` in window `N`

### Negate a pattern

Prefix a pattern with `{!:}` to hide tabs that match it.

## Preferences

The popup includes a `More ...` section with additional actions and preferences.

Available preferences include:

- sort mode
- reverse sort
- startup key sequence
- close-on-go behaviour
- font size

## Project information

- Changelog: [CHANGELOG.md](CHANGELOG.md)
- Privacy policy: [PRIVACY.md](PRIVACY.md)
- Development and build notes: [DEVELOPER.md](DEVELOPER.md)
- License: [LICENSE.txt](LICENSE.txt)

Tabhunter is not related to the actor Tab Hunter.

