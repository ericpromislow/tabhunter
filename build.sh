cd chrome
rm -f tabhunter.jar
cat << ZAK | zip tabhunter.jar -@
./content/asyncTabCollector.js
./content/selectTabDialog.js
./content/sessionTrack.js
./content/selectTabDialog.xul
./content/tabhunter.js
./content/tabhunterOverlay.xul
./content/prefs.xul
./content/prefs.js
./content/frameScripts/browser-window-focus.js
./content/frameScripts/docType-has-image.js
./content/frameScripts/search-next-tab.js
./locale/en-US/tabhunter.dtd
./locale/en-US/tabhunter.properties
./locale/en-US/strings.properties
./skin/martini-16x16.png
./skin/martini-24x24.png
./skin/tabhunter-install.png
./skin/tabhunter.css
ZAK
# zip -r tabhunter.jar content locale skin
cd ..
T=tabhunter-1.0.17.xpi
rm -f $T
zip $T  chrome.manifest install.rdf chrome/tabhunter.jar defaults/preferences/prefs.js
