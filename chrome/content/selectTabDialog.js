// Copyright (C) Eric Promislow 2008.  All Rights Reserved.
// See full license in tabhunter.js

var globalMessageManager, Cc, Ci;

if (typeof(Cc) === "undefined") {
    Cc = Components.classes;
    Ci = Components.interfaces;
}

if (typeof(globalMessageManager) == "undefined") {
    globalMessageManager = (function () {
        try {
            return Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager);
        } catch(ex) {
            return null;
        }
    })();
}

var gTabhunter = {};
(function() {

   const Debug = false;
   const NULL_CURRENT_TAB_LIST_LIMIT = 10;
   const NULL_CURRENT_TAB_LIST_TIMEOUT = 200;

this.addAddonBarButtonIfNeeded = function() {
    var addonBar = document.getElementById("addon-bar");
    if (addonBar) {
        //this.dump("Found an addon bar");
        if (!document.getElementById("tabhunterToolbarIcon")) {
            //this.dump("But no tabhunterToolbarIcon");
            var addonBarCloseButton = document.getElementById("addonbar-closebutton")
                addonBar.insertItem("tabhunterToolbarIcon", addonBarCloseButton.nextSibling);
            addonBar.collapsed = false;
        } else {
            //this.dump("Already have tabhunterToolbarIcon");
        }
    } else {
        //this.dump("Didn't find an addon bar");
    }
};
// //div[class='left_col']/div/span/[text() = 'RESOLVED']
this.onLoad = function() {
    try {
        this.addAddonBarButtonIfNeeded();
    } catch(ex) {
        this.dump("Error while checking addon bar button: " + ex);
    }
    try {
        this.mainHunter = window.arguments[0];
        if (typeof(this.mainHunter) == 'undefined') {
            this.mainHunter = ep_extensions.tabhunter;
        }
        this.prefs = (Components.classes['@mozilla.org/preferences-service;1']
                      .getService(Components.interfaces.nsIPrefService)
                      .getBranch('extensions.tabhunter.'));
        var vals = [];
        ['screenX', 'screenY', 'innerHeight', 'innerWidth'].
        forEach(function(prop) {
                if (this.prefs.prefHasUserValue(prop)) {
                    window[prop] = this.prefs.getIntPref(prop);
                }
            }.bind(this));
        this.patternField = document.getElementById('pattern');
        this.patternField.value = this.mainHunter.searchPattern;
        this.patternField.select();
        this.currentPatternText = null; // first time only, then always text.
    
        this.currentURLField = document.getElementById("view-url");
    
        this.currentTabList = document.getElementById('currentTabList');
        var self= this;
        this.currentTabList.addEventListener('mousedown',
                                             function(event) {
                                                 if (event.button == 2 && self.currentTabList.selectedCount == 0) {// context button
                                                     var listitem = event.originalTarget;
                                                     if (listitem && listitem.nodeName == "listitem") {
                                                         listitem.parentNode.selectItem(listitem);
                                                     }
                                                 }
                                             }, true);
    
        this.currentTabList.addEventListener('keypress',
                                             function(event) {
                                                 if (event.keyCode == 13) {
                                                     // treat return in listbox same as in pattern
                                                     event.stopPropagation();
                                                     event.preventDefault();
                                                     if (event.target.nodeName == "listbox" && self.currentTabList.selectedCount == 1) {
                                                         self.doAcceptTab(true);
                                                     }
                                                     return false;
                                                 }
                                                 return true;
                                             }, true);
        // window.addEventListener('focus', this.windowFocusCheckSetup, false);
        this.lastGoodPattern = /./;
    
        this.observerService = Components.classes["@mozilla.org/observer-service;1"].
        getService(Components.interfaces.nsIObserverService);
                        
        this.statusField = document.getElementById("matchStatus");
        this.strbundle = document.getElementById("strings");
        this.tabBox = document.getElementById("th.tabbox");

        // This has to be done before calling getTabs() because 
        // tabhunterSession.init loads the frame-scripts.
	var reactor, reactorFunc;
        //this.dump("onLoad: globalMessageManager:" + globalMessageManager + ", tabCollector: " + tabCollector);
	if (globalMessageManager && tabCollector) {
	   tabCollector.init(globalMessageManager);
	   this.reactor = tabCollector;
	   this.reactorFunc = tabCollector.collectTabs;
	   this.pattern_RE = null;
	} else {
	   this.reactor = this.mainHunter;
	   this.reactorFunc = this.mainHunter.getTabs;
	}
	   
        this.tabhunterSession = new TabhunterWatchSessionService(this, this.updateOnTabChange);
        this.tabhunterSession.init();
        // this.setupWatcher(); -- use the moz session tracker to do this. 
        var getTabsCallback = function() {
            try {
                this.loadList();
                this._showNumMatches(this.allTabs);
                this.patternField.focus();
    
                // Fix the titlebar
                var app = Components.classes["@mozilla.org/xre/app-info;1"].
                getService(Components.interfaces.nsIXULAppInfo);
                var appName = app.name;
                var appVendor = app.vendor;
                var title = window.document.title;
                if (title.indexOf(appName) == -1) {
                    var s = "";
                    if (appVendor) s = appVendor;
                    if (appName) s += " " + appName;
                    title += " - " + s;
                    window.document.title = title;
                }
                this.eol = navigator.platform.toLowerCase().indexOf("win32") >= 0 ?  "\r\n" : "\n";

                if (window.innerHeight < 200) {
                    window.innerHeight = 270;
                }
                if (window.innerWidth < 300) {
                    window.innerWidth = 450;
                }
            } catch(ex2) {
                this.mainHunter.dump("Error loading tabhunter in getTabsCallback: " + ex2 + "\n" + ex2.stack);
            }
        }.bind(this);
        this.init(getTabsCallback);
    } catch(ex) {
        this.mainHunter.dump("Error loading tabhunter: " + ex + "\n" + ex.stack);
    }
};

this.init = function(getTabsCallback) {
    var reactor, reactorFunc;
    if (globalMessageManager && tabCollector) {
        this.reactor = tabCollector;
        this.reactorFunc = tabCollector.collectTabs;
    } else {
        this.reactor = this.mainHunter;
        this.reactorFunc = this.mainHunter.getTabs;
    }

    this.reactorFunc.call(this.reactor, function(results) {
	 this.mainHunter.dump("QQQ: >> mainHunter::init: in callback")
            try {
            this.allTabs = results.tabs;
            this.allTabs.sort(this.compareByName);
            this.windowInfo = results.windowInfo;
            this.mainHunter.dump("QQQ: >> mainHunter::init: set this.windowInfo to " + this.windowInfo);
            if (getTabsCallback) {
	       this.mainHunter.dump("QQQ: >> mainHunter::init: do getTabsCallback");
                getTabsCallback();
            }
            } catch(e) {
                this.mainHunter.dump("mainHunter::init: error: " + e + ", stack:" + e.stack);
            }                
        }.bind(this));
};

this.compilePattern = function() {
    var p = this.patternField.value;
    // Regular regex notation
    // Allow users to type incomplete REs, use last one
    try {
        this.lastGoodPattern =
            this.pattern_RE = p ? new RegExp(p, 'i') :  /./;
    } catch(ex) {
        this.pattern_RE = this.lastGoodPattern;
    }
};

this.clearList = function() {
    this.currentTabList.ensureIndexIsVisible(0);
    while(true) {
        var i = this.currentTabList.getRowCount();
        if (i == 0) break;
        this.currentTabList.removeItemAt(i - 1);
    }
};

this.testMatch = function(s) {
    try {
        if (this.pattern_RE.test(s)) {
            return true;
        }
    } catch(ex) {
        this.tabhunterSession.dump("Not a pattern: " + this.pattern_RE + "\n");
    }
    try {
        return s.indexOf(this.pattern_RE) >= 0;
    } catch(ex) {
        this.tabhunterSession.dump(ex + "\n");
    }
    return true;
};

this._finishListItem = function(listitem, tab) {
    listitem.setAttribute('class', 'listitem-iconic listitemTabhunter');
    if (tab.image) {
        listitem.setAttribute('image', tab.image);
    //} else {
    //XXX - what's the URI for the default favicon?
    //   listitem.setAttribute('image', 'chrome://browser/skin/places/defaultFavicon.png');
    }
    listitem.setAttribute('context', 'listPopupMenu');
};

this.loadList = function() {
    this.clearList();
    this.compilePattern();
    for (var tab, i = 0; tab = this.allTabs[i]; i++) {
        var s = this.getTabTitleAndURL(tab);
        if (this.pattern_RE.test(s)) {
            var listitem = this.currentTabList.appendItem(s, i);
            this._finishListItem(listitem, tab);
        }
    }
    if (this.currentTabList.getRowCount() > 0) {
        this.currentTabList.selectedIndex = 0;
    }
};

this.labelFromList = function(idx, lowerCase) {
    var s = this.allTabs[this.currentTabList.getItemAtIndex(idx).getAttribute('value')].label;
    if (lowerCase) s = s.toLowerCase();
    return s;
};

this.updateOnPatternChange = function() {
    this.compilePattern();
    var newTabs = this.allTabs;
    try {
        this._updateList(newTabs);
    } catch(ex) {
        this.tabhunterSession.dump("updateOnPatternChange exception: " + ex);
    }
};

this.updateOnTabChange = function() {
  this.mainHunter.dump("QQQ: >> this.mainHunter.updateOnTabChange via reactor...")
  var self = this;
    this.reactorFunc.call(this.reactor, function(results) {
	 self.mainHunter.dump("QQQ: And now in the updateOnTabChange callback");
            var newTabs = results.tabs;
            newTabs.sort(self.compareByName);
            try {
	       // TODO: Consider always calling loadList and doing a smart update
	       // against the existing list.  Look at both URIs and indices -- this might
	       // be why sometimes clicking on a line goes to a tab near it.  The indices
	       // aren't getting correctly updated.
	       if (self.pattern_RE === null) {
		  self.allTabs = newTabs;
		  self.loadList();
	       } else {
                self._updateList(newTabs);
	       }
            } catch(ex) {
                self.tabhunterSession.dump("updateOnTabChange exception: " + ex + ", " + ex.stack);
            }
            self.allTabs = newTabs;
            self.windowInfo = results.windowInfo;
            // And either update the text-search tab, or invalidate it
        });
};

 this._updateList = function(newTabs) {
    if (this.allTabs == null) {
      this.mainHunter.dump("QQQ:_updateList: this.allTabs == null -- not adding tabs to the list");
        // we're shutting down
        return;
    }
    var newLen = newTabs.length;
    var oldLen = this.currentTabList.getRowCount();
    this.mainHunter.dump("QQQ:_updateList: oldLen:" + oldLen + ", newLen:" + newLen);
    var i = 0, j = 0;
    var currentLabel, currentIdx = 0, finalCurrentIdx = -1;
    try {
        var tabIdx = this.currentTabList.selectedItem.getAttribute('value');
        currentLabel = this.allTabs[tabIdx].label.toLowerCase();
    } catch(ex) {
        currentLabel = null;
        finalCurrentIdx = 0;
    }
    while (i < newLen && j < oldLen) {
        // i tracks the new list of tabs, j tracks the current list
        var newTab = newTabs[i];
        var s = this.getTabTitleAndURL(newTab);
        if (!this.pattern_RE.test(s)) {
            i += 1;
            continue;
        }
        var oldLabel = this.labelFromList(j, true);
        var newLabel = newTab.label.toLowerCase();
        // figure out which item we'll select next time
        if (currentLabel && finalCurrentIdx == -1
            && newLabel >= currentLabel) {
            finalCurrentIdx = j;
        }
        if (newLabel == oldLabel) {
            // re-assign the internal value field to point to the new list
            this.currentTabList.getItemAtIndex(j).setAttribute('value', i);
            i += 1;
            j += 1;
        } else if (newLabel < oldLabel) {
            var listitem = this.currentTabList.insertItemAt(j, s, i);
            this._finishListItem(listitem, newTab);
            i += 1;
            j += 1;
            oldLen += 1;
        } else { // newLabel > oldLabel
            this.currentTabList.removeItemAt(j);
            // stay at the same point in the list
            oldLen -= 1;
        }
    }
    if (i < newLen) {
        for (; i < newLen; i += 1) {
            var newTab = newTabs[i];
            var s = this.getTabTitleAndURL(newTab);
            if (this.pattern_RE.test(s)) {
                var listitem = this.currentTabList.appendItem(s, i);
                this._finishListItem(listitem, newTab);
            }
        }
    } else if (j < oldLen) {
        for (; j < oldLen; oldLen -= 1) {
            this.currentTabList.removeItemAt(j);
        }
    }
    if (this.currentTabList.getRowCount() > 0) {
        if (finalCurrentIdx == -1) {
            finalCurrentIdx = 0;
        }
        this.currentTabList.selectedIndex = finalCurrentIdx;
        this.currentTabList.ensureIndexIsVisible(finalCurrentIdx);
    }
    this._showNumMatches(newTabs);
};

this._showNumMatches = function(newTabs) {
    var totalSize = newTabs.length;
    var currSize = this.currentTabList.getRowCount();
    // matchedTabsTemplate
    this.statusField.value =
        (this.patternField.value.length == 0
         ? this.strbundle.getFormattedString("showingTabsTemplate",
                        [ totalSize,
                         this.strbundle.getString(totalSize == 1
                                                 ? 'tabSingular'
                                                 : 'tabPlural')])
         : this.strbundle.getFormattedString("matchedTabsTemplate",
                        [ currSize, totalSize,
                         this.strbundle.getString(totalSize == 1
                                                 ? 'tabSingular'
                                                 : 'tabPlural')]));
};

this.showCurrentURL = function() {
    try {
        if (!this.currentTabList.selectedItem) {
	    if (Debug) {
	        this.dump("gTabhunter.showCurrentURL: this.currentTabList.selectedItem is null");
	    }
  	    return;
        }
        var tabIdx = this.currentTabList.selectedItem.getAttribute('value');
        var location = this.allTabs[tabIdx].location;
        this.currentURLField.value = globalMessageManager ? location : location.href;
        this.currentURLField.removeAttribute('class');
    } catch(ex) {
        this.dump("Error in showCurrentURL: "  + ex + "\n");
        this.currentURLField.value = this.strbundle.getString("notApplicableLabel");
        this.currentURLField.setAttribute('class', 'nohits');
    }
};

this.onKeyPress = function(event)  {
    switch (event.keyCode) {
    case KeyEvent.DOM_VK_RETURN:
        this.doAcceptTab(true, event.ctrlKey);
        return false;
    case KeyEvent.DOM_VK_UP:
    case KeyEvent.DOM_VK_DOWN:
    case KeyEvent.DOM_VK_HOME:
    case KeyEvent.DOM_VK_PAGE_UP:
    case KeyEvent.DOM_VK_PAGE_DOWN:
    case KeyEvent.DOM_VK_END:
        if (event.shiftKey
            || event.ctrlKey) {
            break;
        }
        // send the event to the list -- is there a better way to do this?
        var evt = document.createEvent("KeyboardEvent");
        evt.initKeyEvent('keypress', // typeArg
                              false, //canBubble
                              false, // cancelable
                              null, // viewArg,
                              event.ctrlKey,
                              event.altKey,
                              event.shiftKey,
                              event.metaKey,
                              event.keyCode,
                              event.charCode);
        this.currentTabList.dispatchEvent(evt);
        // Need to cancel this event?
        return false;
    }
    setTimeout(function(self) {
        self.updateSelectedTabs.call(self);
    }, 0, this);
    return true;
};

this.updateSelectedTabs = function() {
    if (this.currentPatternText == this.patternField.value) {
        return;
    }
    this.currentPatternText = this.patternField.value;
    this.updateOnPatternChange();
    this.showCurrentURL();
};

this.onInput = this.updateSelectedTabs;

this.onCancel = function() {
    this._clearInfo();
    return true;
};

this.onClose = function() {
    this.onCancel();
    close();
}

this.selectTab = function() {
    this.showCurrentURL();
};

this.onDoubleClick = function() {
    return this.onAccept();
};

this.onUnload = function() {
  try {
    if (tabCollector) {
      tabCollector.onUnload();
    }
  
    this.tabhunterSession.onUnload();
    this.mainHunter.searchPattern = this.patternField.value;
    ['screenX', 'screenY', 'innerHeight', 'innerWidth'].
    forEach(function(prop) {
	 this.prefs.setIntPref(prop, window[prop]);
      }.bind(this));
    this.gTSTreeView = null;
    this._clearInfo();
  }catch(ex) {
    this.dump("Error in selectTabDialog.js:onUnload: " + ex + "::" + ex.stack);
  }    
};

this.doAcceptTab = function(maybeCloseOnReturn) {
    var selectedItem = this.currentTabList.selectedItem;
    if (!selectedItem) return;
    this.doAcceptTabByIdx(selectedItem.getAttribute('value'));
    if (maybeCloseOnReturn && this.prefs.getBoolPref('closeOnReturn')) {
        window.close();
    }
}

this.doAcceptTabByIdx = function(tabIdx) {
    var tabInfo = this.allTabs[tabIdx];
    var windowIdx = tabInfo.windowIdx;
    var windowInfo = this.windowInfo[windowIdx];
    if (Debug) {
       this.dump("QQQ: doAcceptTabByIdx: tabIdx: " + tabIdx
			     + ", windowIdx:" + windowIdx);
       this.dump("QQQ: doAcceptTabByIdx: windowInfo: " + windowInfo);
       if (windowInfo) {
	  this.dump("QQQ: doAcceptTabByIdx: windowInfo: " + Object.keys(windowInfo).join(", "));
       }
    }
    this.finishMoveToTab(windowInfo, tabInfo.tabIdx);
};

this.finishMoveToTab = function(windowInfo, tabIdx) {
    var targetWindow = windowInfo.window;
    var targetBrowser = targetWindow.getBrowser();
    var tabContainer = targetBrowser.tabContainer;
    tabContainer.selectedIndex = tabIdx;
    targetWindow.focus();
    if (globalMessageManager) {
        // Assume if the tab is gone we're never going to try to send it a message, so no need to listen for
        // message-manager-disconnect notifications.
        try {
            var tab = tabContainer.selectedItem;
            tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:content-focus");
        } catch(ex) {
            var consoleService = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);
            consoleService.logStringMessage("* targetBrowser.selectedBrowser.messageManager.sendAsyncMessage: failed: " + ex);
        }
            
    } else {
        targetBrowser.contentWindow.focus();
    }
};
this.onAccept = function() {
    this.doAcceptTab(false);
    this._clearInfo();
    return true;
};

this.acceptTab = function() {
  this.doAcceptTab(true);
}

this._clearInfo = function() {
    this.allTabs = this.windowInfo = null;
};

this.rebuildView = function() {
    this.updateList();
}

this.showListPopupMenu = function(listPopupMenu) {
    try {
        var numSelectedItems = this.currentTabList.selectedCount;
        var goMenuItem = document.getElementById("th-lpm-go");
        if (numSelectedItems == 1) {
            goMenuItem.removeAttribute('disabled');
        } else {
            goMenuItem.setAttribute('disabled', 'true');
        }
    } catch(ex) {
        this.dump("showListPopupMenu: error: " + ex);
    }
};

this.contextClose = function() {
    try {
        var items = document.popupNode.parentNode.selectedItems;
        for (var li, i=0; li = items[i]; ++i) {
            this.closeListItem(li);
        }
    } catch(ex) {
        this.tabhunterSession.dump("contextClose: " + ex);
    }
};

this.closeListItem = function(li) {
    try {
        var idx = li.value;
        var thTab = this.allTabs[idx];
        var windowInfo = this.windowInfo[thTab.windowIdx];
        var targetWindow = windowInfo.window;
        var tabContainer = targetWindow.getBrowser().tabContainer;
        if (tabContainer.childNodes.length == 1) {
            targetWindow.close();
        } else {
            targetWindow.getBrowser().removeTab(windowInfo.tabs[thTab.tabIdx]);
        }
        // Should trigger a list update
    } catch(ex) { this.tabhunterSession.dump(ex + "\n"); }
};

this.contextGo = function() {
    try {
        var listItem = document.popupNode;
        listItem.parentNode.selectedItem = listItem;
        this.doAcceptTabByIdx(listItem.value);
    } catch(ex) { this.tabhunterSession.dump(ex + "\n"); }
};

var copyToClipboard = function(str) {
    const gClipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].
        getService(Components.interfaces.nsIClipboardHelper);
    gClipboardHelper.copyString(str);
};

this._getListitemLabels = function() {
    var listitems = this.currentTabList.selectedItems;
    var labels = [];
    for (var li, i = 0; li = listitems[i]; i++) {
        var label = li.label;
        if (label) labels.push(label);
    }
    return labels;
}

this.doCopyURLParts = function(func) {
    try {
        var labels = this._getListitemLabels();
        var urls = [];
        for (var label, i = 0; label = labels[i]; i++) {
            urls.push(func(label));
        }
        if (urls.length > 0) {
            copyToClipboard(urls.join(this.eol));
        }
    } catch(ex) {
        this.tabhunterSession.dump(ex);
    }
};

this.copyURL = function(event) {
    this.doCopyURLParts(function(s) {
        var idx = s.lastIndexOf(" - ");
        return s.substring(idx + 3)
    });
};


this.copyTabTitle = function(event) {
    this.doCopyURLParts(function(s) {
        var idx = s.lastIndexOf(" - ");
        return s.substring(0, idx);
    });
};

this.copyTabTitle_URL = function(event) {
    this.doCopyURLParts(function(s) {
        return s;
    });
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
        
 this.dump = function(aMessage) {
   var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
   .getService(Components.interfaces.nsIConsoleService);
   consoleService.logStringMessage("th: " + aMessage);
 };

}).apply(gTabhunter);
