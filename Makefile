TARGET=firefox
VERSION=3.2.2

TDIR=build/${TARGET}
TBDIR=$(TDIR)/build
ZIPPER=$(TBDIR)/tabhunter-$(TARGET)-$(VERSION).zip
TDIRS=$(TDIR) $(TDIR)/build $(TDIR)/_locales $(TDIR)/_locales/en $(TDIR)/icons \
	$(TDIR)/popup $(TDIR)/popup/images $(TDIR)/content

SOURCES=$(TDIR) $(TBDIR) $(TDIR)/_locales $(TDIR)/_locales/en $(TDIR)/icons $(TDIR)/popup \
		$(TDIR)/_locales/en/messages.json \
		$(TDIR)/icons/martini-16x16.png \
		$(TDIR)/icons/martini-24x24.png \
		$(TDIR)/icons/martini-32x32.png \
		$(TDIR)/icons/tabhunter-install.png \
		$(TDIR)/icons/th-128x128.png \
		$(TDIR)/icons/th-32x32.png \
		$(TDIR)/icons/th-48x48.png \
		$(TDIR)/icons/th-96x96.png \
		$(TDIR)/LICENSE.txt  \
		$(TDIR)/README.md  \
		$(TDIR)/build.sh  \
		$(TDIR)/manifest.json  \
		$(TDIR)/content/matchText.js \
		$(TDIR)/popup/jquery-3.2.1.min.js \
		$(TDIR)/popup/prefs.css \
		$(TDIR)/popup/prefs.html \
		$(TDIR)/popup/prefs.js \
		$(TDIR)/popup/images/restore12.png \
		$(TDIR)/popup/tabhunter.css \
		$(TDIR)/popup/tabhunter.html \
		$(TDIR)/popup/tabhunter.js

all: build all-firefox all-chrome

all-firefox:
	$(MAKE) -e TARGET=firefox do-firefox

all-chrome:
	$(MAKE) -e TARGET=chrome do-chrome

do-firefox: $(TDIRS) $(ZIPPER)

do-chrome: $(TDIRS) $(TDIR)/popup/browser-polyfill.min.js $(ZIPPER) 

$(ZIPPER): $(SOURCES)
	cd $(TDIR) ; ./build.sh

build:
	mkdir -p $@

$(TDIR) $(TDIR)/build $(TDIR)/_locales $(TDIR)/_locales/en $(TDIR)/icons $(TDIR)/popup $(TDIR)/popup/images $(TDIR)/content:
	mkdir -p $@

$(TDIR)/_locales/en/messages.json: _locales/en/messages.json
	cp $< $@

$(TDIR)/icons/martini-16x16.png: icons/martini-16x16.png
	cp $< $@

$(TDIR)/icons/martini-24x24.png: icons/martini-24x24.png
	cp $< $@

$(TDIR)/icons/martini-32x32.png: icons/martini-32x32.png
	cp $< $@

$(TDIR)/icons/tabhunter-install.png: icons/tabhunter-install.png
	cp $< $@

$(TDIR)/icons/th-128x128.png: icons/th-128x128.png
	cp $< $@

$(TDIR)/icons/th-32x32.png: icons/th-32x32.png
	cp $< $@

$(TDIR)/icons/th-48x48.png: icons/th-48x48.png
	cp $< $@

$(TDIR)/icons/th-96x96.png: icons/th-96x96.png
	cp $< $@

$(TDIR)/LICENSE.txt : LICENSE.txt
	cp $< $@

$(TDIR)/README.md : README.md
	cp $< $@

$(TDIR)/build.sh : build.sh.erb Makefile
	TARGET=${TARGET} VERSION=${VERSION} erb -T 2 $< > $@
	chmod +x $@

$(TDIR)/manifest.json : manifest.json.erb Makefile
	TARGET=${TARGET} VERSION=${VERSION} erb -T 2 $< > $@

$(TDIR)/popup/browser-polyfill.min.js: popup/browser-polyfill-0.2.1.min.js
	cp $< $@

$(TDIR)/popup/jquery-3.2.1.min.js: popup/jquery-3.2.1.min.js
	cp $< $@

$(TDIR)/content/matchText.js: content/matchText.js.erb
	TARGET=${TARGET} VERSION=${VERSION} erb -T 2 $< > $@
	node -c $@

$(TDIR)/popup/prefs.css: popup/prefs.css
	cp $< $@

$(TDIR)/popup/prefs.js: popup/prefs.js.erb Makefile
	TARGET=${TARGET} VERSION=${VERSION} erb -T 2 $< > $@
	node -c $@

$(TDIR)/popup/tabhunter.css: popup/tabhunter.css
	cp $< $@

$(TDIR)/popup/tabhunter.html: popup/tabhunter.html.erb popup/_prefs.html.erb  Makefile
	TARGET=${TARGET} VERSION=${VERSION} erb -T 2 $< > $@

$(TDIR)/popup/tabhunter.js: popup/tabhunter.js.erb Makefile
	TARGET=${TARGET} VERSION=${VERSION} erb -T 2 $< > $@
	node -c $@

$(TDIR)/popup/prefs.html: popup/prefs.html.erb popup/_prefs.html.erb Makefile
	TARGET=${TARGET} VERSION=${VERSION} erb -T 2 $< > $@

$(TDIR)/popup/images/restore12.png: popup/images/restore12.png
	cp $< $@



