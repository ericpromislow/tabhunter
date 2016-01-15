T=tabhunter-1.0.26.xpi
rm -f $T
cat << ZAK | zip $T -@
./chrome/content/asyncTabCollector.js
./chrome/content/selectTabDialog.js
./chrome/content/sessionTrack.js
./chrome/content/selectTabDialog.xul
./chrome/content/tabhunter.js
./chrome/content/tabhunterOverlay.xul
./chrome/content/prefs.xul
./chrome/content/prefs.js
./chrome/content/frameScripts/browser-window-focus.js
./chrome/content/frameScripts/docType-has-image.js
./chrome/content/frameScripts/search-next-tab.js
./chrome/locale/en-US/tabhunter.dtd
./chrome/locale/en-US/tabhunter.properties
./chrome/locale/en-US/strings.properties
./chrome/skin/martini-16x16.png
./chrome/skin/martini-24x24.png
./chrome/skin/tabhunter-install.png
./chrome/skin/tabhunter.css
chrome.manifest
install.rdf
defaults/preferences/prefs.js
ZAK
