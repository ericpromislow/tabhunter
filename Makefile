# Build it properly
VERSION?=$(shell sed -n 's/^[ \t]*em:version="\([0-9.]*\)"/\1/p' install.rdf)
DEBUG?=false
METRICS?=false
# Whether to loop through all the windows or visit them via set-timeout
ITER1?=true 
SHOW_ERRORS?=false

TXPI=tabhunter-${VERSION}.xpi

SOURCES=./chrome/content/asyncTabCollector.js \
./chrome/content/selectTabDialog.js \
./chrome/content/sessionTrack.js \
./chrome/content/selectTabDialog.xul \
./chrome/content/tabhunter.js \
./chrome/content/tabhunterOverlay.xul \
./chrome/content/prefs.xul \
./chrome/content/prefs.js \
./chrome/content/frameScripts/browser-window-focus.js \
./chrome/content/frameScripts/docType-has-image.js \
./chrome/content/frameScripts/search-next-tab.js \
./chrome/locale/en-US/tabhunter.dtd \
./chrome/locale/en-US/tabhunter.properties \
./chrome/locale/en-US/strings.properties \
./chrome/skin/martini-16x16.png \
./chrome/skin/martini-24x24.png \
./chrome/skin/tabhunter-install.png \
./chrome/skin/tabhunter.css \
chrome.manifest \
install.rdf \
defaults/preferences/prefs.js

${TXPI}: ${SOURCES}
	zip -r $@ ${SOURCES}

%.js : %.js.erb jsenv.rb Makefile
	DEBUG=${DEBUG} METRICS=${METRICS} ITER1=${ITER1} SHOW_ERRORS=${SHOW_ERRORS} \
	erb -T 0 -r jsenv $< > $@

