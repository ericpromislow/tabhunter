{
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * Based on firefox/source/browser/components/sessionstore/src/nsSessionStore.js
 *
 * The Initial Developer of the Original Code is
 * Eric Promislow <eric.promislow@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

/* :::::::: Constants and Helpers ::::::::::::::: */

const Cc = Components.classes;
const Ci = Components.interfaces;

// global notifications observed
const OBSERVING = [
  "domwindowopened", "domwindowclosed",
];

function TabhunterWatchSessionService(reactor, func) {
    this.reactor = reactor;
    this.reactorFunc = func;
}

TabhunterWatchSessionService.prototype = {
    
    dump: function(aMessage) {
        try {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage("My component: " + aMessage);
        } catch(ex) {
            // after closing, Components might be undefined.
        }
    },

  /**
   * Initialize the component
   */
  init: function thst_init() {

    var observerService = Cc["@mozilla.org/observer-service;1"].
                          getService(Ci.nsIObserverService);

    OBSERVING.forEach(function(aTopic) {
      observerService.addObserver(this, aTopic, false);
    }, this);
    // watch the current windows
    var  wmService = (Components.classes["@mozilla.org/appshell/window-mediator;1"].
                      getService(Components.interfaces.nsIWindowMediator));
    
    var openWindows = wmService.getEnumerator("navigator:browser");
    do {
        var win = openWindows.getNext();
        this.onLoad(win, true);
    } while(openWindows.hasMoreElements());
  },

  /**
   * Handle notifications
   */
  observe: function thst_observe(aSubject, aTopic, aData) {
    // for event listeners
    var _this = this;

    switch (aTopic) {
    case "domwindowopened": // catch new windows
      aSubject.addEventListener("load", function(aEvent) {
        aEvent.currentTarget.removeEventListener("load", arguments.callee, false);
        _this.onLoad(aEvent.currentTarget, false);
        }, false);
      break;
    case "domwindowclosed": // catch closed windows
      this.onClose(aSubject);
      break;
    }
  },

/* ........ Window Event Handlers .............. */

  /**
   * Implement nsIDOMEventListener for handling various window and tab events
   */
  handleEvent: function thst_handleEvent(aEvent) {
    switch (aEvent.type) {
      case "load":
        this.onTabLoad(aEvent.currentTarget.ownerDocument.defaultView,
                       aEvent.currentTarget, aEvent);
        break;
      case "TabOpen":
      case "TabClose":
        var panelID = aEvent.originalTarget.linkedPanel;
        var tabpanel = aEvent.originalTarget.ownerDocument.getElementById(panelID);
        if (aEvent.type == "TabOpen") {
          this.onTabAdd(aEvent.currentTarget.ownerDocument.defaultView, tabpanel, false);
        }
        else {
          this.onTabRemove(aEvent.currentTarget.ownerDocument.defaultView, tabpanel, false);
        }
        break;
      case "TabMove":
        var tabpanels = aEvent.currentTarget.mPanelContainer;
        this.onTabMove(aEvent.currentTarget.ownerDocument.defaultView, tabpanels);
        break;
    }
  },

  /**
   * Set up event listeners for this window's tabs
   * @param aWindow
   *        Window reference
   */
  onLoad: function thst_onLoad(aWindow, aNoNotification) {
    if (!aWindow) {
        this.dump("!!! thst_onLoad: aWindow is null");
        return;
    }

    // ignore non-browser windows and windows opened while shutting down
    if (aWindow.document.documentElement.getAttribute("windowtype") != "navigator:browser")
      return;
    
    var tabbrowser = aWindow.getBrowser();
    var tabContainer = tabbrowser.tabContainer;
    var tabpanels = tabbrowser.mPanelContainer;
    
    // add tab change listeners to all already existing tabs
    for (var i = 0; i < tabpanels.childNodes.length; i++) {
      this.onTabAdd(aWindow, tabpanels.childNodes[i], true);
    }
    // notification of tab add/remove/selection
    var self = this;
    var func = function(event) {
        self.handleEvent.call(self, event);
    }
    tabContainer.addEventListener("TabOpen", func, false);
    tabContainer.addEventListener("TabClose", func, false);
    tabContainer.addEventListener("TabMove", func, false);
    if (!aNoNotification)
        this.reactorFunc.call(this.reactor);
  },

  onClose: function thst_onClose(aWindow) {
    
    this.reactorFunc.call(this.reactor);
    //XXX: Figure out why this doesn't work.
    if (!aWindow || typeof(aWindow.getBrowser) != 'function') return;
    var tabbrowser = aWindow.getBrowser();
    if (tabbrowser) {
        // It might be gone already.
        var tabContainer = tabbrowser.tabContainer;
        var tabpanels = tabbrowser.mPanelContainer;
    
        //XXX Define a method we can remove 
        //tabContainer.removeEventListener("TabOpen", func, false);
        //tabContainer.removeEventListener("TabClose", func, false);
        //tabContainer.removeEventListener("TabMove", func, false);
        
        for (var i = 0; i < tabpanels.childNodes.length; i++) {
          this.onTabRemove(aWindow, tabpanels.childNodes[i], true);
        }
    }
  },

  onTabAdd: function thst_onTabAdd(aWindow, aPanel, aNoNotification) {
    var self = this;
    var func = function(event) {
        self.handleEvent.call(self, event);
    }
    aPanel.addEventListener("load", func, true);
    if (!aNoNotification)
        this.reactorFunc.call(this.reactor);
  },

  onTabRemove: function thst_onTabRemove(aWindow, aPanel, aNoNotification) {
    //TODO: cache the event-handler, refer to it here, and delete it.  Based on panel ID?
    // aPanel.removeEventListener("load", func, true);
    var self = this;
    if (!aNoNotification) {
        setTimeout(function(self) {
            try {
            self.reactorFunc.call(self.reactor);
            } catch(ex) {
                this.dump(ex + "\n");
            }
        }, 60, self);
    }
  },

  onTabLoad: function thst_onTabLoad(aWindow, aPanel, aEvent) {
    this.reactorFunc.call(this.reactor);
  },

  onTabMove: function thst_onTabSelect(aWindow, aPanels) {
    this.reactorFunc.call(this.reactor);
  },

  __NULL__ : null
};
