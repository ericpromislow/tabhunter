cd chrome
rm -f tabhunter.jar
cat << ZAK | zip tabhunter.jar -@
./content/selectTabDialog.js
./content/sessionTrack.js
./content/selectTabDialog.xul
./content/tabhunter.js
./content/tabhunterOverlay.xul
./content/prefs.xul
./content/prefs.js
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
T=tabhunter-0.9.4.xpi
rm -f $T
zip $T  chrome.manifest install.rdf chrome/tabhunter.jar defaults/preferences/prefs.js
