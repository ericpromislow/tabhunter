# Tabhunter

## Help wade through all your tabs

### Based on the much-loved, classic Firefox extension

This extension lets you easily juggle dozens of tabs at any time. Enter a
search string (could be a JavaScript regex for you power-users), highlight
the URL you want to bring up, and press return or double-click it.
Tabhunter will even bring up minimized windows containing the desired tab.

Inspired by Davide Ficano's tab selector extension for ActiveState's
Komodo IDE, and my own need for some assistance in managing my
web-based workload. Not to be confused by the actor from the 1950s
and early '60s, known by some as 'Tab "Space" Hunter' to avoid any
ambiguity. Note the proper spelling of this add-on is "Tabhunter"
with a capital T, lower-case h.

### Download
* https://addons.mozilla.org/addon/tabhunter/

### Usage

Press `Shift-Ctrl-T` on Macs, `Ctrl-5` on Linux machines, and as of
this update, `Shift-Ctrl-S` on Windows
or click on the icon (the '5' was chosen because it's about the closest
key to the 'T' that wasn't used by standard Firefox and Chrome, but 
this doesn't work on Windows).

You can select more than one entry, and do a bulk-close or 
bulk copy-and-paste -- see the other buttons on the dialog. They used
to hide in a context menu, but no more.

Version 2.0 introduces the "Audio Only" checkbox, just what you were
looking for to find that tab that started playing an ad or a
video.

Version 3.0 reinstates searching the text in tabs as well, and
supports JS regexes (put `regex:` at the start of your search
pattern to force this (not the url/title matcher)), and XPath expressions
(highly recommended you put `xpath:` at the start of the search
term, because a specific xpath expression with a long condition
part in square brackets will happily work as a regex for many more
documents).

### See LICENSE.txt for license details.

## Build Instructions
Make sure [Ruby's ERB gem](https://github.com/ruby/erb) is installed.

```
git clone git@github.com:ericpromislow/tabhunter.git
cd tabhunter
make
```

In firefox, load `.../tabhunter/build/firefox/build/tabhunter-firefox-VERSION.zip`.
In chrome, load `.../tabhunter/build/firefox/chrome/tabhunter-firefox-VERSION.zip`.

See the build output for `VERSION`.  The `VERSION` value is set on line 2 of `Makefile`.
