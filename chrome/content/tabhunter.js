// Copyright (C) Eric Promislow 2008 - 2015.  All Rights Reserved.
// See full license in tabhunter.js

const NEXT_TIMEOUT = 1;
const MAX_NUM_TAB_TRIES = 100;
const TAB_LOADING_WAIT_MS = 50;

try {

var globalMessageManager, Cc, Ci;

if (typeof(Cc) === "undefined") {
    Cc = Components.classes;
    Ci = Components.interfaces;
}

if (typeof(globalMessageManager) == "undefined") {
    var getGlobalMessageManager = function() {
        try {
            return Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager);
        } catch(ex) {
            return false;
        }
    }
    globalMessageManager = getGlobalMessageManager();
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
    function TabInfo(windowIdx, tabIdx, label, image, location) {
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
            if (globalMessageManager) {
                this.getTabs_dualProcess(callback);
            } else {
                this.getTabs_singleProcess(callback);
            }
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
                this.dump('tabhunter.js - getTabs_singleProcess: image - <' + image + ">");
                obj.tabs.push(new TabInfo(windowIdx, i, label, image, tab.linkedBrowser.contentWindow.location.href));
            }
        } while (openWindows.hasMoreElements());
        callback(obj);
    };

    this.dualProcessContinuationFinish = function() {
      if (!this.tabGetters.every(function(tabGetter) tabGetter.finishedGettingTabs)) {
	return false;
      }
      this.dump("**** all tabs are done at " + this.timestamp + ", loop over " +
		this.tabGetters.length + " tabs");
      clearTimeout(this.callbackTimeoutId);
      // pour everything into the return obj and
      // pass it on using the callback
      let result = { tabs:[], windowInfo:[] }
      this.tabGetters.forEach(function(tabGetter) {
	   try {
	      this.dump("QQQ: concat in " + tabGetter.collector.tabs.length + " tabs");
	      result.tabs = result.tabs.concat(tabGetter.collector.tabs);
	      this.dump("QQQ: result.windowInfo.push: " + tabGetter.collector.currWindowInfo);
	      result.windowInfo.push(tabGetter.collector.currWindowInfo);
	   } catch(e2) {
	      this.dump("**** this.tabGetters.forEach: bad: " + e2);
	   }
	}.bind(this));
      this.dump("QQQ: result:tabs: " + result.tabs.length
		+ ", windowInfo: " + result.windowInfo.length);
      result.tabs.forEach(function(tab) {
	   this.dump("QQQ: window/tab " + tab.windowIdx + "-" + tab.tabIdx + "/" + tab.label + " - " + tab.location);
	}.bind(this));
      //TODO: XXX: dump result here, as it's coming back empty.
      this.tabGetterCallback(result);
      return true;
    };

    this.getTabs_dualProcessContinuation = function(msg) {
        try {
	  var data = msg.data;
	  var tabIdx = data.tabIdx;
	  var windowIdx = data.windowIdx;
	  var windowTabKey = windowIdx + "-" + tabIdx;
	  if (!this.tabGetters) {
	     this.dump(">> getTabs_dualProcessContinuation unexpected:!this.tabGetters, ignore, windowTabKey:" + windowTabKey);
	     var s = [];
	     var funcCount = 0;
	     for (var p in this) {
		if (typeof(this[p]) != "function") s.push(p);
		else if (funcCount == 1) {
		   s.push(p);
		   funcCount += 1;
		}
	     }
	     this.dump("props of this: " + s.join(" "));
	     return;
	  }
	  //this.dump(">> getTabs_dualProcessContinuation: msg: " + Object.keys(msg).join(" "));
	  // this.dump(">> getTabs_dualProcessContinuation: data: " + Object.keys(data).join(" "));
	  //this.dump("QQQ: and keys(this): " + Object.keys(this).join(" "));
	  if (data.timestamp < this.timestamp) {
	    this.dump("QQQ: got a message from an older request " + ((this.timestamp - data.timestamp)/1000000.0) + " msec ago");
	    return;
	  }
	  if (this.processedTabs[windowTabKey]) {
	    this.dump("QQQ: we've already processed windowTabKey " + windowTabKey);
	    this.dualProcessContinuationFinish();
	    return;
	  }
	  var hasImage = data.hasImage;
	  var location = data.location;
	  this.dump("QQQ: getTabs_dualProcessContinuation: tabIdx: " + tabIdx +
		    ", windowIdx: " + windowIdx +
		    ", hasImage: " + hasImage +
		    ", location: " + location);
                  
	  var tabGetter = this.tabGetters[windowIdx];
	  //RRR this.dump("QQQ: windowIdx: " + windowIdx + ", tabGetter: " + tabGetter);
	  var tab = tabGetter.tabs[tabIdx];
	  var label = tab.label;
	  if (location == "about:blank" && tabGetter.connectAttempt < MAX_NUM_TAB_TRIES) {
	     this.dump("QQQ: !!!! Wait to reload window -- about:blank tabGetter.connectAttempt: " + tabGetter.connectAttempt);
	     tabGetter.connectAttempt += 1;
	     setTimeout(function(timestamp) {
		  tabGetter.setImageSetting(tabIdx, timestamp);
	       }, TAB_LOADING_WAIT_MS, this.timestamp);
	     return;
	  }
	  this.processedTabs[windowTabKey] = true;
	  //RRR this.dump("QQQ: tabGetter.collector.currWindowInfo: " + Object.keys(tabGetter.collector.currWindowInfo).join(", "));
	  //RRR this.dump("QQQ: tabGetter.collector.currWindowInfo.tabs: " + Object.prototype.toString.call(tabGetter.collector.currWindowInfo.tabs));
	  tabGetter.collector.currWindowInfo.tabs.push(tab);
	  //var image = data.hasImage ? tab.getAttribute('image') : '';
	  var image = tab.getAttribute('image') || '';
	  tabGetter.collector.tabs.push(new TabInfo(windowIdx, tabIdx, label, image, location));
	  this.dump("QQQ: collector for window " + windowIdx +
		    ", now has " + tabGetter.collector.tabs.length + " tabs");
	  if (tabIdx < tabGetter.tabs.length - 1) {
	     setTimeout(function() {
		  this.dump("QQQ: go get location/image for window " + windowIdx +
			    ", tab " + (tabIdx + 1) + ", title:" + tabGetters.tabs[tabIdx + 1].label + ", ts " + this.timestamp);
		  tabGetter.setImageSetting(tabIdx + 1, this.timestamp);
	       }.bind(this), NEXT_TIMEOUT);
	  } else {
            this.dump("**** dualProcessContinuation: all done with window " + windowIdx);
            tabGetter.finishedGettingTabs = true;
	    if (!this.dualProcessContinuationFinish()) {
	      this.dump("**** continue on with TabGetter(" + (windowIdx + 1) + ")");
	      this.tabGetters[windowIdx + 1].setImageSetting(0, this.timestamp);
	    }
	  }
        } catch(e) {
            this.dump("**** dualProcessContinuation: bad happened: " + e + "\n" + e.stack);
        }
    };

    this.process_docType_has_image_continuation_msg = function(msg) {
      ep_extensions.tabhunter.dump("**** >>> Handling a docType-has-image-continuation notific'n");
      ep_extensions.tabhunter.getTabs_dualProcessContinuation(msg);
    };
    //this.process_docType_has_image_continuation_msg_bound = this.process_docType_has_image_continuation_msg.bind(this);
    if (globalMessageManager) {
        globalMessageManager.addMessageListener("tabhunter@ericpromislow.com:docType-has-image-continuation", this.process_docType_has_image_continuation_msg);
    }
    
    this.TabGetter = function(windowIdx, openWindow, tabs) {
        this.windowIdx = windowIdx;
        this.openWindow = openWindow;
        this.tabs = tabs;
        this.finishedGettingTabs = false;
	this.connectAttempt = 0; // to allow for doc loading
        this.collector = { tabs: [],
                           currWindowInfo: {window: openWindow, tabs: []}};
    };
    this.TabGetter.prototype.isConnecting = function(s) {
      if (!s || s.indexOf("Connecting") != 0) return false;
      return s.match(/Connecting\s*(?:…|\.\.\.)/);
    }  
    this.TabGetter.prototype.setImageSetting = function(tabIdx, timestamp) {
        var tab = this.tabs[tabIdx];
        ep_extensions.tabhunter.dump("**** go do docType-has-image for windowIdx " +
                  this.windowIdx + ", tabIdx: " + tabIdx + " <" + tab.label + ">");
        var windowIdx = this.windowIdx;
	var self = this;
	var loadReadyTabFunc = function() {
	  if (self.isConnecting(tab.label) && self.connectAttempt < MAX_NUM_TAB_TRIES) {
	    ep_extensions.tabhunter.dump("**** don't like tab.label " + tab.label + " at attempt " + self.connectAttempt);
	    self.connectAttempt += 1;
	    setTimeout(loadReadyTabFunc, TAB_LOADING_WAIT_MS);
	    return;
	  }
	  tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:docType-has-image", { tabIdx: tabIdx, windowIdx: windowIdx, timestamp:timestamp });
	};
	loadReadyTabFunc();
    };
    this.getTabs_dualProcess = function(callback) {
        // Get all the windows with tabs synchronously. Then get the
        // image info for each tab asynchronously, knit everything
        // together, and send the result back via the callback.
        var openWindows = this.wmService.getEnumerator("navigator:browser");
        var windowIdx = -1;
        this.tabGetters = [];
        this.tabGetterCallback = callback;
        this.processedTabs = {}; // hash "windowIdx-tabIdx : true"
        this.timestamp = new Date().valueOf();
        // Get the eligible windows 
        do {
            // There must be at least one window for an extension to run in
            var openWindow = openWindows.getNext();
            try {
                var tc = openWindow.getBrowser().tabContainer.childNodes;
            } catch(ex) {
                continue;
            }
            windowIdx += 1;
            this.dump("**** setup TabGetter(" + windowIdx + ")");
            this.tabGetters.push(new this.TabGetter(windowIdx, openWindow, tc));
        } while (openWindows.hasMoreElements());
        this.tabGetters[0].setImageSetting(0, this.timestamp);
        /***/
        this.callbackTimeoutId = setTimeout(function() {
                this.dump("**** Failed to continue getting tabs");
                callback({ tabs:[], windowInfo:[] });
                // Allow 2 seconds per window
            }.bind(this), 2000 * this.tabGetters.length);
        //for (var i = 0; i < this.tabGetters.length; i++ ) {
        //    this.tabGetters[i].setImageSetting(0);
        //}
        /****/
        /****
        var doSetImage = function(this_, i) {
            this_.tabGetters[i].setImageSetting(0);
            if (i + 1 < this_.tabGetters.length) {
                setTimeout(function() {
                        doSetImage(this_, i + 1);
                    }, 30000);
            }
        }
        doSetImage(this, 0);
        ****/
    };
    
    this.getTabTitleAndURL = function(tab) {
        var s = tab.label;
        try {
            s += " - " + tab.location;
        } catch(ex) {}
        return s;
    }
    
    this.compareByName = function(tab1, tab2) {
        return (tab1.label_lc < tab2.label_lc
                ? -1 : (tab1.label_lc > tab2.label_lc ? 1 : 0));
    }
    
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
	if (globalMessageManager) {
	   var self = this;
	   this.dump("QQQ: Stop listening on docType-has-image-continuation");
	   globalMessageManager.removeMessageListener("tabhunter@ericpromislow.com:docType-has-image-continuation", this.process_docType_has_image_continuation_msg_bound);
	   var  wmService = (Components.classes["@mozilla.org/appshell/window-mediator;1"].
			     getService(Components.interfaces.nsIWindowMediator));
	   var openWindows = wmService.getEnumerator("navigator:browser");
	   do {
	      // There must be at least one window for an extension to run in
	      var openWindow = openWindows.getNext();
	      try {
		 Array.slice(openWindow.getBrowser().tabContainer.childNodes).forEach(function(tab) {
		      try {
		      tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:docType-has-image-shutdown", {});
		      tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:content-focus-shutdown", {});
		      tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:search-next-tab", {});
		      } catch(ex2) {
			 self.dump("QQQ !!! Failed to shutdown docType FS: " + ex2);
		      }
		   });
	      } catch(ex3) {
		 self.dump("QQQ !!! Failed to shutdown docType FS: " + ex3);
	      }
	   } while (openWindows.hasMoreElements());
	}
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
                ep_extensions.tabhunter.onload(e); },
        false);
 window.onunload = ep_extensions.tabhunter.onunload;
}catch(e) {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage("tabhunter startup: " + e);
        consoleService.logStringMessage("th failure stack: " + e.stack);
}
