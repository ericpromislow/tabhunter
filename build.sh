#!/bin/sh

version=${1:-2.1.3}
zip -r tabhunter-${version}.zip LICENSE.txt  README.md \
   _locales/ icons/ manifest.json \
   popup/{tabhunter,prefs}.{css,html,js} \
   popup/jquery-3.2.1.min.js popup/browser-polyfill.min.js \
   -x '*~'

#  key.pem
