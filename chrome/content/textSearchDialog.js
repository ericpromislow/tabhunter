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

var g_tabInfo = null;

const URI_ID = "treecol-url";
const TITLE_ID = "treecol-title";
const TEXT_ID = "treecol-text";

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
    dialog.useRegex = document.getElementById("ts-regex");
    dialog.useXPath = document.getElementById("ts-xpath");
    dialog.useCurrentTabs = document.getElementById("ts-currentURIs");
    
    dialog.badXPathBox = document.getElementById("ts-badXPath");
    dialog.badXPathDescription = document.getElementById("badXPath.description");
    
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
}

function adjustRowCount(oldCount, newCount) {
    var boxObject =
        dialog.tree.treeBoxObject.QueryInterface(Components.interfaces.nsITreeBoxObject);
    // boxObject.rowCountChanged(0, newCount - oldCount);
    boxObject.beginUpdateBatch();
    boxObject.invalidate();
    boxObject.endUpdateBatch();
}

function startSearch() {
    gTreeView.dump(">> startSearch");
    debugger;
    try {
        var pattern = dialog.pattern.value;
        if (pattern.length == 0) {
            gTreeView.dump("pattern is empty");
            return;
        }
        g_tabInfo = {};
        mainHunter.getTabs(g_tabInfo);
        var ignoreCase = dialog.ignoreCase.checked;
        var useRegex = dialog.useRegex.checked;
        var useXPath = dialog.useXPath.checked;
        
        var useCurrentTabs = dialog.ignoreCase.useCurrentTabs; //XXX Support this.
        var windows = g_tabInfo.windowInfo;
        var oldCount = gTreeView._rows.length;
        if (useRegex) {
            var regex = new RegExp(pattern, ignoreCase ? "i" : undefined);
        } else {
            var patternFinal;
            if (ignoreCase) {
                patternFinal = pattern.toLowerCase();
            } else {
                patternFinal = pattern;
            }
        }
        gTreeView._rows = [];
        for (var win, windowIdx = 0; win = windows[windowIdx]; windowIdx++) {
            var tc = win.window.getBrowser().tabContainer;
            var tcNodes = tc.childNodes;
            for (var tab, tabIdx = 0; tab = tcNodes[tabIdx]; tabIdx++) {
                var view = tab.linkedBrowser.contentWindow;
                var doc = view.document;
                var title = doc.title;
                var url = doc.location;
                var res, posn, matchedText = null;
                this._rows = [];
                var searchText = doc.documentElement.innerHTML;
                if (useXPath) {
                    var contextNode = doc.documentElement;
                    var namespaceResolver = document.createNSResolver(contextNode.ownerDocument == null
                                                                      ? contextNode.documentElement
                                                                      : contextNode.ownerDocument.documentElement);
                    var resultType = XPathResult.ANY_UNORDERED_NODE_TYPE;
                    var nodeSet = null;
                    try {
                        nodeSet = doc.evaluate(pattern, contextNode, namespaceResolver, resultType, null);
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
                        break;
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
                } else if (useRegex) {
                    res = regex.exec(searchText);
                    if (res) {
                        matchedText = RegExp.lastMatch;
                    }
                } else {
                    var searchTextFinal = ignoreCase ? searchText.toLowerCase() : searchText;
                    posn = searchTextFinal.indexOf(patternFinal);
                    if (posn >= 0) {
                        matchedText = searchText.substring(posn, pattern.length);
                    }
                }
                if (matchedText) {
                    gTreeView._rows.push(buildRow(url, title, matchedText + ":" + posn,
                                                  windowIdx, tabIdx, posn, matchedText));
                }
            }
        }
        var newCount = gTreeView._rows.length;
        adjustRowCount(oldCount, newCount);
        gTreeView.dump("We should be stopped");
        debugger;
    } catch(ex) {
        gTreeView.dump("startSearch: " + ex)
        for (var p in ex) {
            var o = ex[p];
            if (typeof(o) != "function")
                gTreeView.dump(p + ":" + ex[p]);
        }
    }
    gTreeView.dump("<< startSearch");
}

function onUnload() {
    gTreeView = null;
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

