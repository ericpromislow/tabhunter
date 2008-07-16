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
 * Portions created by Eric Promislow are Copyright (C) 2008.
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
    this.getTabs = function(obj) {
        try {
            return this.getTabs_aux(obj);
        } catch(ex) {
            this.dump('tabhunter.js - getTabs - ' + ex);
        }
        return null;
    };
    
    this.getTabs_aux = function(obj) {
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
                var image = "";
                if (tab.linkedBrowser.contentDocument.contentType.indexOf("image/") != 0) {
                    var image = tab.getAttribute('image');
                }
                obj.tabs.push(new TabInfo(windowIdx, i, label, image, tab.linkedBrowser.contentWindow.location));
            }
        } while (openWindows.hasMoreElements());
    };
    
    this.getTabTitleAndURL = function(tab) {
        var s = tab.label;
        try {
            s += " - " + tab.location.href;
        } catch(ex) {}
        return s;
    }
    
    this.compareByName = function(tab1, tab2) {
        return (tab1.label_lc < tab2.label_lc
                ? -1 : (tab1.label_lc > tab2.label_lc ? 1 : 0));
    }
    
    this.launchDialog = function() {
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
        window.openDialog(th_uri,
                          'tabhunterEx',
                          'chrome,titlebar,resizable=yes,minimizable=yes,close=yes,dialog=no',
                          this);
    }
    this.dump = function(aMessage) {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage("My component: " + aMessage);
    };
    
}).apply(ep_extensions.tabhunter);
