// Copyright (C) Eric Promislow 2008.  All Rights Reserved.
// See full license in tabhunter.js

var gTabhunter = {};
(function() {

this.onLoad = function() {
    this.mainHunter = window.arguments[0];
    if (typeof(this.mainHunter) == 'undefined') {
        this.mainHunter = ep_extensions.tabhunter;
    }
    this.acceptedItem = "";
    this.patternField = document.getElementById('pattern');
    this.patternContents = '';
    this.currentPatternText = null; // first time only, then always text.
    
    this.currentURLField = document.getElementById("view-url");
    this.currentURLContents = ''; //yagni?
    
    this.currentTabList = document.getElementById('currentTabList');
    this.lastGoodPattern = /./;
    
    this.observerService = Components.classes["@mozilla.org/observer-service;1"].
                        getService(Components.interfaces.nsIObserverService);
                        
    this.statusField = document.getElementById("matchStatus");
    this.strbundle = document.getElementById("strings");

    this.init();
    this.loadList();
    this._showNumMatches();
    this.tabhunterSession = new TabhunterWatchSessionService(this, this.updateOnTabChange);
    this.tabhunterSession.init();
    // this.setupWatcher(); -- use the moz session tracker to do this. 
    this.patternField.focus();
    
    // Fix the titlebar
    var app = Components.classes["@mozilla.org/xre/app-info;1"].
                getService(Components.interfaces.nsIXULAppInfo);
    var appName = app.name;
    var title = window.document.title;
    if (title.indexOf(appName) == -1) {
        title += " - " + appName;
        window.document.title = title;
    }
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

this.loadList = function() {
    this.clearList();
    this.compilePattern();
    for (var tab, i = 0; tab = this.allTabs[i]; i++) {
        var s = this.mainHunter.getTabTitleAndURL(tab);
        if (this.pattern_RE.test(s)) {
            this.currentTabList.appendItem(s, i);
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
        if (currentLabel && finalCurrentIdx == -1) {
            if (newLabel < currentLabel) {
                currentIdx = i;
            } else if (newLabel == currentLabel) {
                finalCurrentIdx = j;
            } else {
                finalCurrentIdx = currentIdx;
            }
        }
        if (newLabel == oldLabel) {
            // re-assign the internal value field to point to the new list
            this.currentTabList.getItemAtIndex(j).setAttribute('value', i);
            i += 1;
            j += 1;
        } else if (newLabel < oldLabel) {
            this.currentTabList.insertItemAt(j, s, i);
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
                this.currentTabList.appendItem(s, i);
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
    this._showNumMatches();
};

this._showNumMatches = function() {
    var totalSize = this.allTabs.length;
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
        this.doAcceptTab();
        return false;
    case KeyEvent.DOM_VK_UP:
    case KeyEvent.DOM_VK_DOWN:
    case KeyEvent.DOM_VK_HOME:
    case KeyEvent.DOM_VK_PAGE_UP:
    case KeyEvent.DOM_VK_PAGE_DOWN:
    case KeyEvent.DOM_VK_END:
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
    this._clearInfo();
}

this.doAcceptTab = function() {
    var selectedItem = this.currentTabList.selectedItem;
    if (!selectedItem) return;
    var tabIdx = selectedItem.getAttribute('value');
    var tabInfo = this.allTabs[tabIdx];
    var windowIdx = tabInfo.windowIdx;
    var windowInfo = this.windowInfo[windowIdx];
    var targetWindow = windowInfo.window;
    var tabContainer = targetWindow.getBrowser().tabContainer;
    tabContainer.selectedIndex = tabInfo.tabIdx;
    targetWindow.focus();
};

this.onAccept = function() {
    this.doAcceptTab();
    this._clearInfo();
    return true;
};

this.acceptTab = function() {
    this.doAcceptTab();
}

this._clearInfo = function() {
    this.allTabs = this.windowInfo = null;
};

this.rebuildView = function() {
    this.updateList();
}

}).apply(gTabhunter);
