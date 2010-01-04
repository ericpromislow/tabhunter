// Copyright (C) Eric Promislow 2008.  All Rights Reserved.
// See full license in tabhunter.js

var gTabhunter = {};
(function() {

// //div[class='left_col']/div/span/[text() = 'RESOLVED']
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

    this.tsOnLoad();
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

this.ts_showPopupMenu = function(listPopupMenu) {
    try {
        var goMenuItem = document.getElementById("th-ts-go");
        if (this.gTSTreeView.selection.count == 1) {
            goMenuItem.removeAttribute('disabled');
        } else {
            goMenuItem.setAttribute('disabled', 'true');
        }
    } catch(ex) {
        alert(ex);
    }
};

this.ts_contextGo  = function() {
    this.ts_onGoCurrentLine();
};

this._rowFromSelectedLine = function(label) {
    var currentLine = this.tsDialog.tree.currentIndex;
    var row = this.gTSTreeView._rows[currentLine];
    if (!row) {
        this.gTSTreeView.dump(label + ": no data at row " + currentLine);
        return null;
    }
    return row;
}

this.ts_contextClose  = function() {
    try {
        var row = this._rowFromSelectedLine("ts_contextClose");
        if (!row) {
            return;
        }
        var windowInfo = this.windowInfo[row.windowIdx];
        var targetWindow = windowInfo.window;
        var tabContainer = targetWindow.getBrowser().tabContainer;
        if (tabContainer.childNodes.length == 1) {
            targetWindow.close();
        } else {
            targetWindow.getBrowser().removeTab(windowInfo.tabs[row.tabIdx]);
        }
    } catch(ex) { this.tabhunterSession.dump(ex + "\n"); }
};

this.ts_copyURL  = function() {
    try {
        var row = this._rowFromSelectedLine("ts_copyURL");
        if (!row) {
            return;
        }
        copyToClipboard(row[this.TS_URI_ID]);
    } catch(ex) { this.tabhunterSession.dump(ex + "\n"); }
};

this.ts_copyTabTitle  = function() {
    try {
        var row = this._rowFromSelectedLine("ts_copyTabTitle");
        if (!row) {
            return;
        }
        copyToClipboard(row[this.TS_TITLE_ID]);
    } catch(ex) { this.tabhunterSession.dump(ex + "\n"); }
};

this.ts_copyURLAndTitle  = function() {
    try {
        var row = this._rowFromSelectedLine("ts_copyURLAndTitle");
        if (!row) {
            return;
        }
        copyToClipboard(row[this.TS_TITLE_ID]
                        + " - "
                        + row[this.TS_URI_ID]);
    } catch(ex) { this.tabhunterSession.dump(ex + "\n"); }
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

this.onSelectTab = function(event) {
    if (this.tabBox.selectedIndex == 1 && this.ts_tabListNeedsRefreshing) {
        this.ts_tabListNeedsRefreshing = false;
        this.ts_startSearch();
    }
}

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
    this.ts_updateOnTabChange();
    // And either update the text-search tab, or invalidate it
};

this.ts_updateOnTabChange = function() {
    if (this.tabBox.selectedIndex == 1) {
        this.ts_tabListNeedsRefreshing = false;
        this.ts_startSearch();
    } else {
        this.ts_tabListNeedsRefreshing = true;
    }
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
    this.mainHunter.searchPattern = this.patternField.value;
    if (this.mainHunter.isLinux()) {
        this.prefs.setIntPref('screenX', screenX);
        this.prefs.setIntPref('screenY', screenY);
    }
    this.gTSTreeView = null;
    this._clearInfo();
}

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
    var targetWindow = windowInfo.window;
    var targetBrowser = targetWindow.getBrowser();
    var tabContainer = targetBrowser.tabContainer;
    tabContainer.selectedIndex = tabInfo.tabIdx;
    targetWindow.focus();
    targetBrowser.contentWindow.focus();
};

this.onAccept = function() {
    this.doAcceptTab(false);
    this._clearInfo();
    return true;
};

this.acceptTab = function() {
    switch (this.tabBox.selectedIndex) {
    case 0:
        this.doAcceptTab(true);
        break;
    case 1:
        this.ts_onGoCurrentLine();
        break;
    default:
        this.dump("Unrecognized tabBox index: " + this.tabBox.selectedIndex);
    }
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

// TextSearch methods

this.tsOnLoad = function() {
try {
    this.tsDialog = {};
  this.tsDialog.tree = document.getElementById("ts-resultsTree");
  this.tsDialog.pattern = document.getElementById("ts-pattern");
  this.tsDialog.ignoreCase = document.getElementById("ts-ignore-case");
  this.tsDialog.searchTypeMenu = document.getElementById("ts-searchTypeMenu");
  this.tsDialog.useCurrentTabs = document.getElementById("ts-currentURIs");
  this.tsDialog.pauseGoButton = document.getElementById("ts-pauseGoButton");
  this.g_SearchingState = this.TS_SEARCH_STATE_DEFAULT;
  this.ts_onInput();
  this.tsDialog.cancelButton = document.getElementById("ts-stopButton");
    
  this.tsDialog.badXPathBox = document.getElementById("ts-badXPath");
  this.tsDialog.badXPathDescription = document.getElementById("ts-badXPath.description");
  this.tsDialog.progressMeter = document.getElementById("tsSearchProgress");
  this.tsDialog.progressMeterLabel = document.getElementById("tsSearchProgressCount");
  this.tsDialog.progressMeterWrapper = document.getElementById("progressMeterWrapper");
  this.tsDialog.tsSearchProgress = document.getElementById("tsSearchProgress");
  this.tsDialog.tsSearchProgressCount = document.getElementById("tsSearchProgressCount");
    
  this.ts_initialize();
}catch(ex) {
    alert("tsOnLoad: " + ex);
}
};

this.TextSearchTreeView = function() {
    this._rows = [];
}

this.TextSearchTreeView.prototype = {
    get rowCount() {
        return this._rows.length;
    },
    
    getCellText : function(row, column) {
        //this.dump("rows...");
        try {
        //this.dump("getCellText("
        //                 + row
        //                 + ", "
        //                 + column.id
        //                 + ") => ["
        //                 + this._rows[row][column.id]
        //                 + "]\n");
        return this._rows[row][column.id];
        } catch(ex) {
            //this.dump("getCellText: " + ex);
            return "";
        }
    },  
    setTree: function(treebox){ this.treebox = treebox; },  
    isContainer: function(row){ return false; },  
    isSeparator: function(row){ return false; },  
    isSorted: function(){ return false; },  
    getLevel: function(row){ return 0; },  
    getImageSrc: function(row,col){ return null; },  
    getRowProperties: function(row,props){},  
    getCellProperties: function(row,col,props){},  
    getColumnProperties: function(colid,col,props){},
    
    dump: function(aMessage) {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage("th/textView/tree: " + aMessage);
    },
    
    _EOL_ : function() {}
};

this.ts_initialize = function() {
    this.gTSTreeView = new this.TextSearchTreeView();
    // this.gTSTreeView.dump("we have rows.");
    this.tsDialog.tree.view = this.gTSTreeView;
    var boxObject =
        this.tsDialog.tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    boxObject.view = this.gTSTreeView;
    this.TS_URI_ID = "treecol-url";
    this.TS_TITLE_ID = "treecol-title";
    this.TS_TEXT_ID = "treecol-text";

    this.TS_SEARCH_STATE_DEFAULT = 0;
    this.TS_SEARCH_STATE_PAUSED = 1;
    this.TS_SEARCH_STATE_CONTINUED = 2;
    this.TS_SEARCH_STATE_CANCELLED = 3

    this.ts_bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://tabhunter/locale/tabhunter.properties");
    this.ts_enterDefaultSearchingState();
    
    this.ts_tabListNeedsRefreshing = false;

}

this.ts_buildRow = function(uri, title, displayText, windowIdx, tabIdx, posn, matchedText) {
    var r = {};
    r[this.TS_URI_ID] = uri;
    r[this.TS_TITLE_ID] = title;
    r[this.TS_TEXT_ID] = displayText;
    r.windowIdx = windowIdx;
    r.tabIdx = tabIdx;
    r.posn = posn;
    r.matchedText = windowIdx;
    return r;
}

this.ts_resetRowCount = function(oldCount) {
    var boxObject =
        this.tsDialog.tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    boxObject.rowCountChanged(0, -oldCount);
}

this.ts_onAddingRecord = function(oldCount) {
    var boxObject =
        this.tsDialog.tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    boxObject.rowCountChanged(oldCount, 1);
}

this.ts_countTabs = function(windows) {
    var sum = 0;
    for (var win, windowIdx = 0; win = windows[windowIdx]; windowIdx++) {
        sum += win.window.getBrowser().tabContainer.childNodes.length;
    }
    return sum;
}

this.Searcher = function(mainObj, dialog) {
    this.ready = false;
    try {
        // set up parameters here.
        this.pattern = dialog.pattern.value;
        mainObj.ts_clearTree();
        if (this.pattern.length == 0) {
            mainObj.gTSTreeView.dump("pattern is empty");
            return;
        }
        this.tabInfo = {};
	this.mainObj = mainObj;
        mainObj.mainHunter.getTabs(this.tabInfo);
        this.ignoreCase = dialog.ignoreCase.checked;
        this.searchType = dialog.searchTypeMenu.selectedItem.value;
        
        if (!!(this.useCurrentTabs = dialog.useCurrentTabs.checked)) {
            var p = null;
            var text = mainObj.patternField.value;
            if (text) {
                try {
                    p = new RegExp(text, 'i');
                } catch(ex) {}
            }
            this.currentTabRE = p;
        } else {
            this.currentTabRE = null;
        }
        this.windows = this.tabInfo.windowInfo;
        if (this.searchType == "searchRegEx") {
            try {
                this.regex = new RegExp(this.pattern,
                                        this.ignoreCase ? "i" : undefined);
            } catch(ex) {
                var msg = ex.message;
                if (ex.inner) msg += "; " + ex.inner;
                if (ex.data) msg += "; " + ex.data;
                var dnode = dialog.badXPathDescription;
                while (dnode.hasChildNodes()) {
                    dnode.removeChild(dnode.firstChild);
                }
                dnode.appendChild(document.createTextNode(msg));
                dialog.badXPathBox.collapsed = false;
                mainObj.ts_enterDefaultSearchingState();
                return;
            }
        } else if (this.searchType == "searchPlainText") {
            if (this.ignoreCase) {
                this.patternFinal = this.pattern.toLowerCase();
            } else {
                this.patternFinal = this.pattern;
            }
        }
        this.tabCount = mainObj.ts_countTabs(this.windows);
        this.windowCount = this.windows.length;
        dialog.progressMeterWrapper.setAttribute('class', 'show');
        dialog.progressMeter.setAttribute('class', 'progressShow');
        dialog.progressMeterLabel.setAttribute('class', 'progressShow');
        this.progressBar = dialog.tsSearchProgress;
        this.progressBar.max = this.tabCount;
        this.progressBar.value = this.numHits = 0;
        this.progressBarLabel = dialog.tsSearchProgressCount;
        //mainObj.gTSTreeView.dump("startSearch: go through "
        //               + this.progressBar.max
        //               + " tabs");
    } catch(ex) {
        mainObj.showMessage("Searcher", ex);
        //for (var p in ex) {
        //    var o = ex[p];
        //    if (typeof(o) != "function") {
        //        mainObj.gTSTreeView.dump(p + ":" + o)
        //    }
        //}
        //mainObj.gTSTreeView.dump("Searcher:" + ex);
        return;
    }
    this.ready = true;
    return;
}

this.showMessage = function(label, ex) {
    var msg = "";
    if (ex.fileName) {
        msg += ex.fileName;
    }
    if (ex.lineNumber) {
        msg += "#" + ex.lineNumber;
    }
    msg += ": " + ex.message;
    alert(label +": " + msg);
    this.gTSTreeView.dump(label +": " + msg);
}

this.Searcher.prototype.setupWindow = function(windowIdx) {
    var tc = this.windows[windowIdx].window.getBrowser().tabContainer;
    this.tabIdx = -1;
    this.tcNodes = tc.childNodes;
    this.currentTabCount = this.tcNodes.length;
};

this.Searcher.prototype.searchNextTab = function() {
    switch (this.mainObj.g_SearchingState) {
        case this.mainObj.TS_SEARCH_STATE_PAUSED:
            this.mainObj.ts_enterPausedSearchingState();
            return;
        case this.mainObj.TS_SEARCH_STATE_CANCELLED:
            this.finishSearch();
            return;
    }
    this.tabIdx += 1;
    while (this.tabIdx >= this.currentTabCount) {
        this.windowIdx += 1;
        if (this.windowIdx >= this.windowCount) {
            this.finishSearch();
            return;
        }
        this.setupWindow(this.windowIdx);
        this.tabIdx = 0;
        // Do this in a loop to handle windows with no tabs.
    }
    this.progressBar.setAttribute("value", parseInt(this.progressBar.value) + 1);
    this.progressBarLabel.value = ("Checking "
                              + this.progressBar.value
                              + "/"
                              + this.progressBar.max);
    var tab = this.tcNodes[this.tabIdx];
    var view = tab.linkedBrowser.contentWindow;
    var doc = view.document;
    var title = doc.title;
    var url = doc.location;
    var failedTest = false;
    if  (this.currentTabRE) {
        if (!this.currentTabRE.test(title) && !this.currentTabRE.test(url)) {
            failedTest = true;
            this.mainObj.gTSTreeView.dump("No match on title:"
                           + title
                           + ", url:"
                           + url);
        }
    }
    if  (!failedTest) {
        var res, posn, matchedText = null;
        var searchText = doc.documentElement.innerHTML;
        if (this.searchType == "searchXPath") {
            var contextNode = doc.documentElement;
            var namespaceResolver = document.createNSResolver(contextNode.ownerDocument == null
                                                              ? contextNode.documentElement
                                                              : contextNode.ownerDocument.documentElement);
            var resultType = XPathResult.ANY_UNORDERED_NODE_TYPE;
            var nodeSet = null;
            try {
                nodeSet = doc.evaluate(this.pattern, contextNode, namespaceResolver, resultType, null);
            } catch(ex) {
                var msg = ex.message;
                if (ex.inner) msg += "; " + ex.inner;
                if (ex.data) msg += "; " + ex.data;
                var dnode = this.mainObj.tsDialog.badXPathDescription;
                while (dnode.hasChildNodes()) {
                    dnode.removeChild(dnode.firstChild);
                }
                dnode.appendChild(document.createTextNode(msg));
                this.mainObj.tsDialog.badXPathBox.collapsed = false;
                this.mainObj.ts_enterDefaultSearchingState();
                return;
            }
            var snv = nodeSet.singleNodeValue;
            if (snv) {
                matchedText = snv.innerHTML;
                if (matchedText) {
                    matchedText = matchedText.replace(/^[\s\r\n]+/, '');
                    if (matchedText.length > 40) {
                        matchedText = matchedText.substring(0, 40) + "...";
                    } else if (matchedText.length == 0) {
                        matchedText = "<white space only>";
                    }
                }
            }
        } else if (this.searchType == "searchRegEx") {
            res = this.regex.exec(searchText);
            if (res) {
                matchedText = RegExp.lastMatch;
            }
        } else {
            var searchTextFinal = this.ignoreCase ? searchText.toLowerCase() : searchText;
            posn = searchTextFinal.indexOf(this.patternFinal);
            if (posn >= 0) {
                matchedText = searchText.substring(posn, this.pattern.length);
            }
        }
        if (matchedText) {
            this.mainObj.ts_onAddingRecord(this.numHits);
            this.numHits += 1;
            this.mainObj.gTSTreeView._rows.
	        push(this.mainObj.ts_buildRow(url,
					      title,
					      matchedText,
					      this.windowIdx,
					      this.tabIdx, posn, matchedText));
        }
    }
    setTimeout(function(this_) {
        try {
            this_.searchNextTab();
        } catch(ex) {
            this_.mainObj.showMessage("Searcher.searchNextTab("
                        + this_.windowIdx
                        + ", "
                        + this_.tabIdx
                        + ")", ex);
        }
    }, 1, this);
}

this.Searcher.prototype.launch = function() {
    this.setupWindow(this.windowIdx = 0);
    try {
        this.searchNextTab();
    } catch(ex) {
        this.mainObj.showMessage("Searcher.searchNextTab(0, 0)", ex);
    }
}

this.Searcher.prototype.finishSearch = function() {
    this.mainObj.ts_enterDefaultSearchingState();
    var newCount = this.mainObj.gTSTreeView._rows.length;
    this.progressBar.setAttribute("value", parseInt(this.progressBar.max));
    this.progressBarLabel.value = "Found " + this.numHits + " in " + this.progressBar.max;
    //this.mainObj.gTSTreeView.dump("<< startSearch");
    setTimeout(function(this_) {
        this_.mainObj.tsDialog.progressMeterWrapper.setAttribute('class', 'hide');
        this_.mainObj.tsDialog.progressMeter.setAttribute('class', 'progressHide');
        this_.mainObj.tsDialog.progressMeterLabel.setAttribute('class', 'progressHide');
        //this_.mainObj.gTSTreeView.dump("Did we hide the progress meter?");
        this_.mainObj.g_searcher = null;
        this_.mainObj.g_SearchingState = this_.mainObj.TS_SEARCH_STATE_DEFAULT;
    }, 3 * 1000, this);
}

// End Searcher object

this.ts_clearTree = function() {
    var oldCount = this.gTSTreeView._rows.length;
    if (oldCount > 0) {
        this.gTSTreeView._rows = [];
        this.ts_resetRowCount(oldCount);
    }
}

this.ts_startSearch = function() {
try {
    //this.gTSTreeView.dump("About to get the searcher");
    // alert("in this.ts_startSearch...");
    this.g_searcher = new this.Searcher(this, this.tsDialog);
    if (this.g_searcher.ready) {
        this.g_SearchingState = this.TS_SEARCH_STATE_CONTINUED;
        this.ts_enterActiveSearchingState();
        setTimeout(function(this_) {
            // delay so the table view gets cleared.
            this_.g_searcher.launch();
        }, 0, this);
    }
} catch(ex) {
    alert(ex);
    this.showMessage('startSearch', ex);
}
}

this.ts_pauseSearch = function() {
    this.g_SearchingState = this.TS_SEARCH_STATE_PAUSED;
}

this.ts_cancelSearch = function() {
    this.g_SearchingState = this.TS_SEARCH_STATE_CANCELLED;
    this.ts_enterDefaultSearchingState();
}

this.ts_continueSearch = function() {
    this.g_SearchingState = this.TS_SEARCH_STATE_CONTINUED;
    this.g_searcher.searchNextTab();
}

this.ts_enterActiveSearchingState = function() {
    this.tsDialog.pauseGoButton.label = this.ts_bundle.GetStringFromName('pause.label');
    var this_ = this;
    this.tsDialog.pauseGoButton.oncommand = function() {
        this_.ts_pauseSearch();
    }
    this.tsDialog.cancelButton.disabled = false;
}

this.ts_enterPausedSearchingState = function() {
    this.tsDialog.pauseGoButton.label = this.ts_bundle.GetStringFromName('continue.label');
    var this_ = this;
    this.tsDialog.pauseGoButton.oncommand = function() {
        this_.ts_continueSearch();
    }
    this.tsDialog.cancelButton.disabled = false;
}

this.ts_enterDefaultSearchingState = function() {
    this.tsDialog.pauseGoButton.label = this.ts_bundle.GetStringFromName('search.label'); 
    var this_ = this;
    this.tsDialog.pauseGoButton.oncommand = function() {
        this_.ts_startSearch();
    }
    this.tsDialog.cancelButton.disabled = true;
}

this.ts_onKeyPress = function(event)  {
    switch (event.keyCode) {
    case KeyEvent.DOM_VK_RETURN:
        if (!this.tsDialog.cancelButton.disabled) {
            this.ts_startSearch();
        }
        return false;
    }
    return true;
}

this.ts_onInput = function() {
    this.tsDialog.pauseGoButton.disabled = (this.g_SearchingState ==
					    this.TS_SEARCH_STATE_DEFAULT
                                     && this.tsDialog.pattern.value.length == 0);
}

this.ts_onSelectSearchType = function(menulist) {
    this.tsDialog.ignoreCase.disabled = (menulist.selectedItem.value == 'searchXPath');
}

this.ts_onTreeDblClick = function(event) {
    if (event.target.nodeName != "treechildren") {
        return;
    }
    this.ts_onGoCurrentLine();
}

this.ts_onGoCurrentLine = function() {
    try {
        var currentLine = this.tsDialog.tree.currentIndex;
        var row = this.gTSTreeView._rows[currentLine];
        if (!row) {
            this.gTSTreeView.dump("no data at row " + row);
            return;
        }
        var windowInfo = this.windowInfo[row.windowIdx];
        var targetWindow = windowInfo.window;
        var targetBrowser = targetWindow.getBrowser();
        var tabContainer = targetBrowser.tabContainer;
        tabContainer.selectedIndex = row.tabIdx;
        targetWindow.focus();
        targetBrowser.contentWindow.focus();
    } catch(ex) { this.gTSTreeView.dump(ex + "\n"); }
};

}).apply(gTabhunter);
