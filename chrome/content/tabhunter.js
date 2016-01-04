// Copyright (C) Eric Promislow 2008 - 2015.  All Rights Reserved.
// See full license in tabhunter.js

try {

var Cc, Ci;

if (typeof(Cc) === "undefined") {
    Cc = Components.classes;
    Ci = Components.interfaces;
}

var ep_extensions;
if (typeof(ep_extensions) == "undefined") {
    ep_extensions = {};
}
if (!("tabhunter" in ep_extensions)) {
    ep_extensions.tabhunter = { searchPattern:"" };
}
(function() {
    this.wmService = (Components.classes["@mozilla.org/appshell/window-mediator;1"].
                      getService(Components.interfaces.nsIWindowMediator));
    this.TabInfo = function(windowIdx, tabIdx, label, image, location) {
        this.windowIdx = windowIdx;
        this.tabIdx = tabIdx;
        this.label = label;
        this.label_lc = this.label.toLowerCase();
        this.image = image;
        this.location = location;
    };
    
    // OUT ARGS: tabs: unordered array of [TabInfo]
    //           windowInfo: array of [window: ChromeWindow, tabs: array of [DOM tabs]]
    this.getTabs = function(callback) {
        try {
	  this.getTabs_singleProcess(callback);
        } catch(ex) {
            this.dump('tabhunter.js - getTabs - ' + ex + "\n" + ex.stack);
        }
    };
    
    this.getTabs_singleProcess = function(callback) {
        var obj = {};
        var openWindows = this.wmService.getEnumerator("navigator:browser");
        obj.tabs = [];
        obj.windowInfo = [];
        var windowIdx = -1;
        do {
            // There must be at least one window for an extension to run in
            var openWindow = openWindows.getNext();
            try {
                var tc = openWindow.getBrowser().tabContainer.childNodes;
            } catch(ex) {
                continue;
            }
            var currWindowInfo = obj.windowInfo[++windowIdx] = {
                window: openWindow,
                tabs: []
            }
            for (var i = 0; i < tc.length; i++) {
                var tab = tc[i];
                currWindowInfo.tabs.push(tab);
                var label = tab.label;
                var image = tab.getAttribute("image") || "";
                //this.dump('tabhunter.js - getTabs_singleProcess: image - <' + image + ">");
                obj.tabs.push(new this.TabInfo(windowIdx, i, label, image, tab.linkedBrowser.contentWindow.location.href));
            }
        } while (openWindows.hasMoreElements());
        callback(obj);
    };
    
    this.launchDialog = function(event) {
        // Look for the window first
        const th_uri = 'chrome://tabhunter/content/selectTabDialog.xul';
        var openWindows = this.wmService.getEnumerator(null);
        do {
            var win = openWindows.getNext();
            if (win.location == th_uri) {
                win.focus();
                var pf = win.document.getElementById('pattern');
                pf.focus();
                pf.select();
                return;
            }
        } while(openWindows.hasMoreElements());
        var features = 'chrome,titlebar,resizable=yes,minimizable=yes,close=yes,dialog=no';
        if (this.isLinux()) {
            // workaround bug http://code.google.com/p/tabhunter/issues/detail?id=12
            // which is based on https://bugzilla.mozilla.org/show_bug.cgi?id=445674
            // other platforms, rely on the moz persist mechanism
            var x, y, props = {};
            if (event && event.type == 'click') {
                props.screenX = event.screenX - 250;
                props.screenY = event.screenY - 400;
            } else {
                props = { screenX:null, screenY:null}
            }
            var prefs = (Components.classes['@mozilla.org/preferences-service;1']
                  .getService(Components.interfaces.nsIPrefService)
                  .getBranch('extensions.tabhunter.'));
            for (var p in props) {
                try {
                    var val = prefs.getIntPref(p);
                    props[p] = val;
                } catch(ex) {
                    // Nothing interesting to report -- either
                    // it's the first time in, and the pref doesn't exist
                    // or someone's been messing with it
                }
            }
            for (var p in props) {
                if (props[p] != null) {
                    features += "," + p + "=" + props[p];
                }
            }
        }
        window.openDialog(th_uri,
                          'tabhunterEx',
                          features,
                          this);
    };
        
    this.dump = function(aMessage) {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage("tabhunter: " + aMessage);
    };
    
    this.isLinux = function() {
        return navigator.platform.search(/linux/i) > -1;
    };
    
    var this_ = this;
    this.keypressWrapper = function(event) {
        return this_.keypressHandler(event);
    };

    this.keypressHandler = function(event) {
        var ctrlKey = event.ctrlKey;
        var metaKey = event.metaKey;
        var keyCode = event.keyCode;
        if (!ctrlKey && !metaKey && !keyCode) {
            return;
        }
        var altKey = event.altKey;
        var shiftKey = event.shiftKey;
        var kbLaunchKey = this.prefs.getCharPref(this.kbLaunchNames.userKey);
        var launchIsKeyCode = this.prefs.getBoolPref(this.kbLaunchNames.userIsKeyCode);
        var charCode = event.charCode;
        if ((!!charCode) == launchIsKeyCode) {
            return;
        }
        if (charCode) {
            charCode = String.fromCharCode(charCode).toUpperCase();
            if (charCode != kbLaunchKey) {
                return;
            }
        } else if (event.keyCode != kbLaunchKey) {
            return;
        }
        var kbLaunchModifiers = this.prefs.getCharPref(this.kbLaunchNames.userModifiers); 
        if (!!ctrlKey == (kbLaunchModifiers.indexOf('control') == -1)) {
            return;
        }
        if (!!metaKey == (kbLaunchModifiers.indexOf('meta') == -1)) {
            return;
        }
        if (!!altKey == (kbLaunchModifiers.indexOf('alt') == -1)) {
            return;
        }
        if (!!shiftKey == (kbLaunchModifiers.indexOf('shift') == -1)) {
            return;
        }
        // If we're here launch the  dude.
        this.launchDialog(null);
        
    };

    this.onload = function() {
        if (document.documentElement.getAttribute('windowtype') != 'navigator:browser') {
            return;
        }        
        this.prefs = (Components.classes['@mozilla.org/preferences-service;1']
                      .getService(Components.interfaces.nsIPrefService)
                      .getBranch('extensions.tabhunter.'));
        this.kbLaunchNames = {
            factoryKey: 'kb-launch-factory-key',
            factoryModifiers: 'kb-launch-factory-modifiers',
            factoryIsKeyCode: 'kb-launch-factory-isKeyCode',
            userKey: 'kb-launch-user-key',
            userModifiers: 'kb-launch-user-modifiers',
            userIsKeyCode: 'kb-launch-user-isKeyCode'
        }
        var kbLaunchModifiers = (window.navigator.platform.search("Mac") == 0
                                 ? "meta control"
                                 : "control alt");
        var kbLaunchKey = "T";
        if (!this.prefs.prefHasUserValue(this.kbLaunchNames.factoryKey)) {
            this.prefs.setCharPref(this.kbLaunchNames.factoryKey, kbLaunchKey);
            this.prefs.setCharPref(this.kbLaunchNames.factoryModifiers, kbLaunchModifiers);
        }
        if (!this.prefs.prefHasUserValue(this.kbLaunchNames.userKey)) {
            this.prefs.setCharPref(this.kbLaunchNames.userKey, kbLaunchKey);
            this.prefs.setCharPref(this.kbLaunchNames.userModifiers, kbLaunchModifiers);
        }
        // patch - yikes
        if (!this.prefs.prefHasUserValue(this.kbLaunchNames.factoryIsKeyCode)) {
            this.prefs.setBoolPref(this.kbLaunchNames.factoryIsKeyCode, false);
        }
        if (!this.prefs.prefHasUserValue(this.kbLaunchNames.userIsKeyCode)) {
            this.prefs.setBoolPref(this.kbLaunchNames.userIsKeyCode, false);
        }
        // wait 5 seconds -- on the mac the status bar icon isn't always present yet.
         setTimeout(function(prefs, self, document) {
            var showStatusBarIcon = prefs.getBoolPref('showStatusBarIcon');
            var showMenuItem = prefs.getBoolPref('showMenuItem');
            document.getElementById("th-status-image").collapsed = !showStatusBarIcon;
            document.getElementById("menuitem_EPExt_TabhunterLaunch").hidden = !showMenuItem;
            document.addEventListener('keypress', self.keypressWrapper, false);
     }, 500, this.prefs, this, window.document);
    };

    this.onunload = function() {
        document.removeEventListener('keypress', this.keypressWrapper, false);
    };

    this.doCommand = function(event) {
        switch(event.button) {
        case 0: 
            this.launchDialog(event);
            break;
        case 2:
            event.preventDefault();
            this.showPreferences();
            break;
        }
    };
    
    this.showPreferences = function(event) {
        var features = 'chrome,titlebar,toolbar=no,close=yes,dialog=no';
        window.openDialog('chrome://tabhunter/content/prefs.xul',
                          'TabhunterPrefs',
                          features);
    };
    
}).apply(ep_extensions.tabhunter);

window.addEventListener("load", 
        function(e) {
	   window.removeEventListener("load", arguments.callee, false);
                ep_extensions.tabhunter.onload(e); },
        false);

 window.onunload = ep_extensions.tabhunter.onunload;
}catch(e) {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage("tabhunter startup: " + e);
        consoleService.logStringMessage("th failure stack: " + e.stack);
}
