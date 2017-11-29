#!/bin/sh

version=${1:-2.0.3}
zip -r tabhunter-${version}.zip LICENSE.txt  README.md key.pem \
   _locales/ icons/ manifest.json \
   popup/tabhunter.{css,html,js} \
   popup/jquery-3.2.1.min.js popup/browser-polyfill.min.js \
   -x '*~'
