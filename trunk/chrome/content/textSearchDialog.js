{
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 * 
 * The contents of this file are subject to the Mozilla Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 * 
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 * 
 * Portions created by Eric Promislow are Copyright (C) 2008-2009.
 * All Rights Reserved.
 * 
 * Initial Contributor(s):
 *   Eric Promislow
 * 
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * 
 * ***** END LICENSE BLOCK ***** */
}


var gTreeView = null;
var mainHunter;
var dialog = {};
var g_SearchingState;

var g_tabInfo = null;
var g_searcher = null;

const URI_ID = "treecol-url";
const TITLE_ID = "treecol-title";
const TEXT_ID = "treecol-text";

const SEARCH_STATE_DEFAULT = 0;
const SEARCH_STATE_PAUSED = 1;
const SEARCH_STATE_CONTINUED = 2;
const SEARCH_STATE_CANCELLED = 3

var _bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                .getService(Components.interfaces.nsIStringBundleService)
                .createBundle("chrome://tabhunter/locale/tabhunter.properties");

function TextSearchTreeView() {
    this._rows = [];
    
}
TextSearchTreeView.prototype = {
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
            this.dump("getCellText: " + ex);
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
        consoleService.logStringMessage("tabhunter: " + aMessage);
    },
    
    _EOL_ : function() {}
};

function onLoad() {
    mainHunter = window.arguments[0].mainHunter;
    g_selectTabDialog = window.arguments[0].selectTabDialog;
    dialog.tree = document.getElementById("resultsTree");
    dialog.pattern = document.getElementById("pattern");
    dialog.ignoreCase = document.getElementById("ts-ignore-case");
    dialog.searchTypeMenu = document.getElementById("searchTypeMenu");
    dialog.useCurrentTabs = document.getElementById("ts-currentURIs");
    dialog.pauseGoButton = document.getElementById("pauseGoButton");
    g_SearchingState = SEARCH_STATE_DEFAULT;
    onInput();
    dialog.cancelButton = document.getElementById("stopButton");
    
    dialog.badXPathBox = document.getElementById("ts-badXPath");
    dialog.badXPathDescription = document.getElementById("badXPath.description");
    
    dialog.progressMeterWrapper = document.getElementById("progressMeterWrapper");
    dialog.tsSearchProgress = document.getElementById("tsSearchProgress");
    dialog.tsSearchProgressCount = document.getElementById("tsSearchProgressCount");
    
    initialize();
}

function buildRow(uri, title, displayText, windowIdx, tabIdx, posn, matchedText) {
    var r = {};
    r[URI_ID] = uri;
    r[TITLE_ID] = title;
    r[TEXT_ID] = displayText;
    r.windowIdx = windowIdx;
    r.tabIdx = tabIdx;
    r.posn = posn;
    r.matchedText = windowIdx;
    return r;
}

function initialize() {
    gTreeView = new TextSearchTreeView();
    //gTreeView.dump("we have rows.");
    dialog.tree.view = gTreeView;
    g_tabInfo = null;
    var boxObject =
        dialog.tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    boxObject.view = gTreeView;
    enterDefaultSearchingState();
}

function resetRowCount(oldCount) {
    var boxObject =
        dialog.tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    boxObject.rowCountChanged(0, -oldCount);
}

function onAddingRecord(oldCount) {
    var boxObject =
        dialog.tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    boxObject.rowCountChanged(oldCount, 1);
}

function countTabs(windows) {
    var sum = 0;
    for (var win, windowIdx = 0; win = windows[windowIdx]; windowIdx++) {
        sum += win.window.getBrowser().tabContainer.childNodes.length;
    }
    return sum;
}

function Searcher(mainHunter, dialog) {
    this.ready = false;
    try {
        // set up parameters here.
        this.pattern = dialog.pattern.value;
        if (this.pattern.length == 0) {
            gTreeView.dump("pattern is empty");
            return;
        }
        g_tabInfo = this.tabInfo = {};
        mainHunter.getTabs(this.tabInfo);
        this.ignoreCase = dialog.ignoreCase.checked;
        gMenu = dialog.searchTypeMenu;
        this.searchType = dialog.searchTypeMenu.selectedItem.value;
        
        if (!!(this.useCurrentTabs = dialog.useCurrentTabs.checked)) {
            var p = null;
            var text = g_selectTabDialog.patternField.value;
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
                enterDefaultSearchingState();
                return;
            }
        } else if (this.searchType == "searchPlainText") {
            this.patternFinal;
            if (this.ignoreCase) {
                this.patternFinal = this.pattern.toLowerCase();
            } else {
                this.patternFinal = this.pattern;
            }
        }
        var oldCount = gTreeView._rows.length;
        gTreeView._rows = [];
        resetRowCount(oldCount);
        this.tabCount = countTabs(this.windows);
        this.windowCount = this.windows.length;
        dialog.progressMeterWrapper.setAttribute('class', 'show');
        this.progressBar = dialog.tsSearchProgress;
        this.progressBar.max = this.tabCount;
        this.progressBar.value = this.numHits = 0;
        this.progressBarLabel = dialog.tsSearchProgressCount;
        gTreeView.dump("startSearch: go through "
                       + this.progressBar.max
                       + " tabs");
    } catch(ex) {
        showMessage("Searcher", ex);
        //for (var p in ex) {
        //    var o = ex[p];
        //    if (typeof(o) != "function") {
        //        gTreeView.dump(p + ":" + o)
        //    }
        //}
        //gTreeView.dump("Searcher:" + ex);
        return;
    }
    this.ready = true;
    return;
}

function showMessage(label, ex) {
    var msg = "";
    if (ex.fileName) {
        msg += ex.fileName;
    }
    if (ex.lineNumber) {
        msg += "#" + ex.lineNumber;
    }
    msg += ": " + ex.message;
    gTreeView.dump(label +": " + msg);
}

Searcher.prototype.setupWindow = function(windowIdx) {
    var tc = this.windows[windowIdx].window.getBrowser().tabContainer;
    this.tabIdx = -1;
    this.tcNodes = tc.childNodes;
    this.currentTabCount = this.tcNodes.length;
}

Searcher.prototype.searchNextTab = function() {
    switch (g_SearchingState) {
        case SEARCH_STATE_PAUSED:
            enterPausedSearchingState();
            return;
        case SEARCH_STATE_CANCELLED:
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
            gTreeView.dump("No match on title:"
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
                var dnode = dialog.badXPathDescription;
                while (dnode.hasChildNodes()) {
                    dnode.removeChild(dnode.firstChild);
                }
                dnode.appendChild(document.createTextNode(msg));
                dialog.badXPathBox.collapsed = false;
                enterDefaultSearchingState();
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
            onAddingRecord(this.numHits);
            this.numHits += 1;
            gTreeView._rows.push(buildRow(url, title, matchedText + ":" + posn,
                                          this.windowIdx, this.tabIdx, posn, matchedText));
        }
    }
    setTimeout(function(this_) {
        try {
            this_.searchNextTab();
        } catch(ex) {
            showMessage("Searcher.searchNextTab("
                        + this_.windowIdx
                        + ", "
                        + this_.tabIdx
                        + ")", ex);
        }
    }, 1, this);
}

Searcher.prototype.launch = function() {
    this.setupWindow(this.windowIdx = 0);
    try {
        this.searchNextTab();
    } catch(ex) {
        showMessage("Searcher.searchNextTab(0, 0)", ex);
    }
}

Searcher.prototype.finishSearch = function() {
    enterDefaultSearchingState();
    var newCount = gTreeView._rows.length;
    this.progressBar.setAttribute("value", parseInt(this.progressBar.max));
    this.progressBarLabel.value = "Found " + this.numHits + " in " + this.progressBar.max;
    gTreeView.dump("<< startSearch");
    setTimeout(function() {
        dialog.progressMeterWrapper.setAttribute('class', 'hide');
        gTreeView.dump("Did we hide the progress meter?");
        g_searcher = null;
        g_SearchingState = SEARCH_STATE_DEFAULT;
    }, 3 * 1000);
}

function startSearch() {
    g_searcher = new Searcher(mainHunter, dialog);
    if (g_searcher.ready) {
        g_SearchingState = SEARCH_STATE_CONTINUED;
        enterActiveSearchingState();
        g_searcher.launch();
    }
}

function pauseSearch() {
    g_SearchingState = SEARCH_STATE_PAUSED;
}

function cancelSearch() {
    g_SearchingState = SEARCH_STATE_CANCELLED;
    enterDefaultSearchingState();
}

function continueSearch() {
    g_SearchingState = SEARCH_STATE_CONTINUED;
    g_searcher.searchNextTab();
}

function enterActiveSearchingState() {
    dialog.pauseGoButton.label = _bundle.GetStringFromName('pause.label');
    dialog.pauseGoButton.oncommand = pauseSearch;
    dialog.cancelButton.disabled = false;
}

function enterPausedSearchingState() {
    dialog.pauseGoButton.label = _bundle.GetStringFromName('continue.label');
    dialog.pauseGoButton.oncommand = continueSearch;
    dialog.cancelButton.disabled = false;
}

function enterDefaultSearchingState() {
    dialog.pauseGoButton.label = _bundle.GetStringFromName('search.label');
    dialog.pauseGoButton.oncommand = startSearch;
    dialog.cancelButton.disabled = true;
}

function onUnload() {
    gTreeView = null;
}

function onClose() {
    window.close();
}

function onKeyPress(event)  {
    switch (event.keyCode) {
    case KeyEvent.DOM_VK_RETURN:
        if (true || !g_inSearch) { // XXX state
            startSearch();
        }
        return false;
    }
    return true;
}

function onInput() {
    dialog.pauseGoButton.disabled = (g_SearchingState == SEARCH_STATE_DEFAULT
                                     && dialog.pattern.value.length == 0);
}

function onSelectSearchType(menulist) {
    dialog.ignoreCase.disabled = (menulist.selectedItem.value == 'searchXPath');
}

function onTreeDblClick(event) {
    if (event.target.nodeName != "treechildren") {
        return;
    }
    onGoCurrentLine();
}

function onGoCurrentLine() {
    try {
        var currentLine = dialog.tree.currentIndex;
        var row = gTreeView._rows[currentLine];
        if (!row) {
            gTreeView.dump("no data at row " + row);
            return;
        }
        var windowInfo = g_tabInfo.windowInfo[row.windowIdx];
        var targetWindow = windowInfo.window;
        var targetBrowser = targetWindow.getBrowser();
        var tabContainer = targetBrowser.tabContainer;
        tabContainer.selectedIndex = row.tabIdx;
        targetWindow.focus();
        targetBrowser.contentWindow.focus();
    } catch(ex) { gTreeView.dump(ex + "\n"); }
};

