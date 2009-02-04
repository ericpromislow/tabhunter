// Copyright (C) Eric Promislow 2008.  All Rights Reserved.
// See full license in tabhunter.js

var gTabhunter = {};
(function() {

this.onLoad = function() {
    this.mainHunter = window.arguments[0];
    if (typeof(this.mainHunter) == 'undefined') {
        this.mainHunter = ep_extensions.tabhunter;
    }
    this.prefs = (Components.classes['@mozilla.org/preferences-service;1']
                  .getService(Components.interfaces.nsIPrefService)
                  .getBranch('extensions.tabhunter.'));
    this.acceptedItem = "";
    this.patternField = document.getElementById('pattern');
    this.patternField.value = this.mainHunter.searchPattern;
    this.patternField.select();
    this.currentPatternText = null; // first time only, then always text.
    
    this.currentURLField = document.getElementById("view-url");
    this.currentURLContents = ''; //yagni?
    
    this.currentTabList = document.getElementById('currentTabList');
    this.closeOnReturnCB = document.getElementById('prefCloseOnReturn');
    this.closeOnReturnPrefName = 'closeOnReturn';
    if (this.prefs.prefHasUserValue(this.closeOnReturnPrefName)) {
        this.closeOnReturnCB.checked = this.prefs.getBoolPref(this.closeOnReturnPrefName);
    } else { 
        this.prefs.setBoolPref(this.closeOnReturnPrefName,
                               this.closeOnReturnCB.checked = true);
        
    }
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
                if (event.target.nodeName == "listbox" && this.numSelectedItems == 1) {
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

    this.init();
    this.loadList();
    this._showNumMatches(this.allTabs);
    this.tabhunterSession = new TabhunterWatchSessionService(this, this.updateOnTabChange);
    this.tabhunterSession.init();
    // this.setupWatcher(); -- use the moz session tracker to do this. 
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
    this.registerPrefsObserver();
    
    this.initKeyConfigPopup();
};

this.init = function() {
    var obj = {};
    this.mainHunter.getTabs(obj);
    this.allTabs = obj.tabs;
    this.allTabs.sort(this.mainHunter.compareByName);
    this.windowInfo = obj.windowInfo;
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
        var s = this.mainHunter.getTabTitleAndURL(tab);
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
    var obj = {};
    this.mainHunter.getTabs(obj);
    var newTabs = obj.tabs;
    newTabs.sort(this.mainHunter.compareByName);
    try {
        this._updateList(newTabs);
    } catch(ex) {
        this.tabhunterSession.dump("updateOnTabChange exception: " + ex);
    }
    this.allTabs = newTabs;
    this.windowInfo = obj.windowInfo;
};

this._updateList = function(newTabs) {
    if (this.allTabs == null) {
        // we're shutting down
        return;
    }
    var newLen = newTabs.length;
    var oldLen = this.currentTabList.getRowCount();
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
        var s = this.mainHunter.getTabTitleAndURL(newTab);
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
            var s = this.mainHunter.getTabTitleAndURL(newTab);
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
        var tabIdx = this.currentTabList.selectedItem.getAttribute('value');
        var location = this.allTabs[tabIdx].location;
        this.currentURLField.value = location.href;
        this.currentURLField.removeAttribute('class');
    } catch(ex) {
        //dump(ex + "\n");
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
    this.unregisterPrefsObserver();
    this.mainHunter.searchPattern = this.patternField.value;
    if (this.mainHunter.isLinux()) {
        this.prefs.setIntPref('screenX', screenX);
        this.prefs.setIntPref('screenY', screenY);
    }
    this._clearInfo();
}

this.doAcceptTab = function(maybeCloseOnReturn) {
    var selectedItem = this.currentTabList.selectedItem;
    if (!selectedItem) return;
    this.doAcceptTabByIdx(selectedItem.getAttribute('value'));
    if (maybeCloseOnReturn && this.closeOnReturnCB.checked) {
        window.close();
    }
}

this.doAcceptTabByIdx = function(tabIdx) {
    var tabInfo = this.allTabs[tabIdx];
    var windowIdx = tabInfo.windowIdx;
    var windowInfo = this.windowInfo[windowIdx];
    var targetWindow = windowInfo.window;
    var tabContainer = targetWindow.getBrowser().tabContainer;
    tabContainer.selectedIndex = tabInfo.tabIdx;
    targetWindow.focus();
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
        alert(ex);
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

// Methods for managing the launch key

this.initKeyConfigPopup = function() {
    this.kbLaunchNames = {
        factoryKey: 'kb-launch-factory-key',
        factoryModifiers: 'kb-launch-factory-modifiers',
        factoryIsKeyCode: 'kb-launch-factory-isKeyCode',
        userKey: 'kb-launch-user-key',
        userModifiers: 'kb-launch-user-modifiers',
        userIsKeyCode: 'kb-launch-user-isKeyCode'
    };
    var launchKey, launchModifiers, launchIsKeyCode;
    if (this.prefs.prefHasUserValue(this.kbLaunchNames.userKey)) {
        launchKey = this.prefs.getCharPref(this.kbLaunchNames.userKey);
        launchIsKeyCode = this.prefs.getBoolPref(this.kbLaunchNames.userIsKeyCode);
        launchModifiers = this.prefs.getCharPref(this.kbLaunchNames.userModifiers);
    } else if (this.prefs.prefHasUserValue(this.kbLaunchNames.factoryKey)) {
        launchKey = this.prefs.getCharPref(this.kbLaunchNames.factoryKey);
        launchModifiers = this.prefs.getCharPref(this.kbLaunchNames.factoryModifiers);
        launchIsKeyCode = this.prefs.getBoolPref(this.kbLaunchNames.factoryIsKeyCode);
    } else {
        launchKey = "T";
        launchModifiers = (window.navigator.platform.search("Mac") == 0
                                 ? "meta control"
                                 : "control alt");
        launchIsKeyCode = false;
    }
    // Init the platform keys (code from twitterfox)
    
    this.localeKeys = document.getElementById("localeKeys");

    var platformKeys = document.getElementById("platformKeys");
    this.platformKeys = {};
    this.platformKeys.shift   = platformKeys.getString("VK_SHIFT");
    this.platformKeys.meta    = platformKeys.getString("VK_META");
    this.platformKeys.alt     = platformKeys.getString("VK_ALT");
    this.platformKeys.control = platformKeys.getString("VK_CONTROL");
    this.platformKeys.sep     = platformKeys.getString("MODIFIER_SEPARATOR");

    this.vkNames = {};
    for (var property in KeyEvent) {
      this.vkNames[KeyEvent[property]] = property.replace("DOM_","");
    }
    this.vkNames[8] = "VK_BACK";
    if (!launchIsKeyCode) {
        this.displayKeyConfigPopup(launchKey, "", launchModifiers);
    } else {
        this.displayKeyConfigPopup("", this.vkNames[launchKey], launchModifiers);
    }
};

this.getPrintableKeyName = function(modifiers,key,keycode) {
    if (modifiers == "shift,alt,control,accel" && keycode == "VK_SCROLL_LOCK") return "";
    
    if (!modifiers && !keycode) {
      return "";
    }
    
    var val = "";
    if (modifiers) {
        val = modifiers.replace(/^[\s,]+|[\s,]+$/g,"").split(/[\s,]+/g).join(this.platformKeys.sep);
    }
    
    var  mod = ["alt", "shift", "control", "meta"];
    for (var i in mod) {
        val = val.replace(mod[i], this.platformKeys[mod[i]]);
    }
    
    if (val) {
        val += this.platformKeys.sep;
    }
    
    if (key) {
        val += key;
    }
    if (keycode) {
      try {
        val += this.localeKeys.getString(keycode);
      }
      catch(e) {
        val += keycode;
      }
    }
    return val;
};

//XXX Handle keycodes as well.
this.displayKeyConfigPopup = function(launchKey, launchKeyCode, launchModifiers) {
    try {
    var val = this.getPrintableKeyName(launchModifiers, launchKey, launchKeyCode);
    if (val) {
      document.getElementById("th-keyConfigPopup").value = val;
    } else {
        this.tabhunterSession.dump("displayKeyConfigPopup: no val for key="
                                   + launchKey
                                   + ", mods:"
                                   + launchModifiers);
    }
    } catch(ex) {
        this.tabhunterSession.dump(ex);
    }
};

this.revertConfigKeyPress = function(event) {
    var launchKey = this.prefs.getCharPref(this.kbLaunchNames.factoryKey);
    var launchModifiers = this.prefs.getCharPref(this.kbLaunchNames.factoryModifiers);
    var launchIsKeyCode = this.prefs.getBoolPref(this.kbLaunchNames.factoryIsKeyCode);
    this.prefs.setCharPref(this.kbLaunchNames.userKey, launchKey);
    this.prefs.setCharPref(this.kbLaunchNames.userModifiers, launchModifiers);
    this.prefs.setBoolPref(this.kbLaunchNames.userIsKeyCode, launchIsKeyCode);
    if (launchIsKeyCode) {
        this.displayKeyConfigPopup("", launchKey, launchModifiers);
    } else {
        this.displayKeyConfigPopup(launchKey, "", launchModifiers);
    }
};

this.handleConfigKeyPress = function(event) {
    // code taken from twitterfox (not under any license)
    event.preventDefault();
    event.stopPropagation();

    var modifiers = [];
    if(event.altKey)   modifiers.push("alt");
    if(event.ctrlKey)  modifiers.push("control");
    if(event.metaKey)  modifiers.push("meta");
    if(event.shiftKey) modifiers.push("shift");

    modifiers = modifiers.join(" ");

    var key = "";
    var keycode = "";
    var prefKey = "";
    if (event.charCode) {
        prefKey = key = String.fromCharCode(event.charCode).toUpperCase();
    } else {
        keycode = this.vkNames[prefKey = event.keyCode];
        if (!keycode) {
            this.tabhunterSession.dump("handleConfigKeyPress: no vk-name for keyCode: " + event.keyCode);
            return;
        }
    }
    this.prefs.setCharPref(this.kbLaunchNames.userKey, prefKey);
    this.prefs.setCharPref(this.kbLaunchNames.userModifiers, modifiers);
    this.prefs.setBoolPref(this.kbLaunchNames.userIsKeyCode, !event.charCode);
    this.displayKeyConfigPopup(key, keycode, modifiers);
    
};


this.togglePrefCloseOnReturn = function(event, cbox) {
  this.prefs.setBoolPref(this.closeOnReturnPrefName, cbox.checked);
};

this.registerPrefsObserver = function() {
    this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2).addObserver("", this, false);
};

this.unregisterPrefsObserver = function() {
    this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2).removeObserver("", this, false);
};

this.observe = function(subject, topic, prefName) {
    if (topic == "nsPref:changed" && prefName == this.closeOnReturnPrefName) {
        this.closeOnReturnCB.checked = this.prefs.getBoolPref(this.closeOnReturnPrefName);
    }
    // We don't care about screenX or screenY
};

}).apply(gTabhunter);
