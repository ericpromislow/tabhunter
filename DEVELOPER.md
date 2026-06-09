# Developer notes

This document covers building and packaging Tabhunter from source.

## Requirements

- Ruby with [ERB](https://ruby-doc.org/stdlib/libdoc/erb/rdoc/ERB.html) available
- Node.js available for JavaScript syntax checks during the build
- `make`

## Build from source

```sh
git clone https://github.com/ericpromislow/tabhunter
cd tabhunter
make
```

The default build target produces both Firefox and Chrome packages.

## Build outputs

The current version is defined in `Makefile` as `VERSION`.

Running `make` creates packaged builds under `build/`:

- Firefox package: `build/firefox/build/tabhunter-firefox-VERSION.zip`
- Chrome package: `build/chrome/build/tabhunter-chrome-VERSION.zip`

## Build targets

Useful make targets include:

- `make` — build everything
- `make all-firefox` — build the Firefox package
- `make all-chrome` — build the Chrome package

## Source layout

- `manifest.json.erb` — manifest template
- `popup/` — popup UI, preferences UI, and client-side logic
- `content/` — content scripts
- `_locales/` — localisation strings
- `icons/` — extension icons

## Loading a local build

Use the unpacked build directories for local testing.

### Firefox

Use Firefox Developer Edition and load the generated manifest temporarily:

1. Build with `make all-firefox` or `make`
2. Open Firefox Developer Edition
3. Go to `about:debugging`
4. Open **This Firefox**
5. Choose **Load Temporary Add-on...**
6. Select `build/firefox/manifest.json`

This is the recommended local workflow because standard Firefox releases enforce signing for normal installs.

### Chrome

Load the unpacked extension from the generated build directory:

1. Build with `make all-chrome` or `make`
2. Open Chrome
3. Go to `chrome://extensions`
4. Enable **Developer mode**
5. Choose **Load unpacked**
6. Select `build/chrome`

After rebuilding, use **Reload** on the extension card to pick up the latest generated files.

## Notes on packaged artifacts

If you need to inspect the packaged extension contents, they are assembled under `build/firefox/` and `build/chrome/` during the build.

The zip files are build artifacts for packaging and distribution. For day-to-day local development, use the unpacked build directories above.
