# Tabhunter Changes

## 2.2.2 - Adds drag & drop

## 3.0.0 - Support searching patterns in loaded tabs

Press the "Search text in tabs" button to get to the secondary pattern field.  Searching is limited to the current set of matched tabs, and then only in those active tabs that aren't internal `about:X` type tabs.

The `Pause/Resume` and `Cancel` buttons do what you think.

You can search by plain text, JavaScript regular expressions, or XPath expressions -- no need to specify which you want. And no worries if you don't understand that sentence -- searching should work just fine for you.  XPath expressions don't support arbitrary namespaces (and if you understand that and are miffed by it, you know enough to fork the project and implement namespace support; as usual, pull requests are welcome).

## 3.0.1 - Text searching improvements

* Update the list of matched tabs as we go
* Support a 'regex:' and 'xpath:' prefix on the text patterns because there are too many false positives with regexes for intended xpath expressions.
