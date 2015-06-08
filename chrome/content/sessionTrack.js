// Copyright (C) Eric Promislow 2008.  All Rights Reserved.
// See full license in tabhunter.js

/* :::::::: Constants and Helpers ::::::::::::::: */

var globalMessageManager, Cc, Ci;

if (typeof(Cc) === "undefined") {
    var Cc = Components.classes;
    var Ci = Components.interfaces;
}

if (typeof(globalMessageManager) == "undefined") {
    function getGlobalMessageManager() {
        try {
            return Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager);
        } catch(ex) {
            return false;
        }
    }
    globalMessageManager = getGlobalMessageManager();
}

// global notifications observed
const OBSERVING = [
  "domwindowopened", "domwindowclosed",
];

function TabhunterWatchSessionService(reactor, func, level) {

    // logging levels:
    this.log_debug = 0;
    this.log_info = 1;
    this.log_warn = 2;
    this.log_error = 3;
    this.log_exception = 4;

    this.reactor = reactor;
    this.reactorFunc = func;
    if (typeof(level) == "undefined") level = this.log_error;
    this.level = level;
}

TabhunterWatchSessionService.prototype = {
    
  dump: function(aMessage, level) {
    if (typeof(level) == "undefined") level = this.log_error;
    if (level < this.level) return;
        try {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage("sessionTrack: " + aMessage);
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
        try {
            setTimeout(function(aSubject_) {
                aSubject_.addEventListener("load", function(aEvent) {
                    aEvent.currentTarget.removeEventListener("load", arguments.callee, false);
                    _this.onLoad(aEvent.currentTarget, false);
                }, false);
            }, 1, aSubject);
        } catch(ex) {
            this.dump("observe:domwindowopened: " + ex)
        }
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
        this.dump("!!! thst_onLoad: aWindow is null", this.log_debug);
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
    setTimeout(function(tabContainer_, func_) {
            tabContainer_.addEventListener("TabOpen", func_, false);
            tabContainer_.addEventListener("TabClose", func_, false);
            tabContainer_.addEventListener("TabMove", func_, false);
        }, 1, tabContainer, func);
    if (!aNoNotification) {
        this.reactorFunc.call(this.reactor);
    } else {
    }
  },

  onClose: function thst_onClose(aWindow) {
    if (aWindow.browserDOMWindow === null) {
      this.dump("closing a non-browser-dom window, ignoring the event");
      return;
    }
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
    try {
        var mm = aPanel.ownerDocument.defaultView.getBrowser().selectedBrowser.messageManager;
        if (mm) {
            mm.loadFrameScript("chrome://tabhunter/content/frameScripts/browser-window-focus.js", true);
        }
    } catch(ex) {
        this.dump("Failed to load the frame script browser-window-focus.js: " + ex);
    }
    setTimeout(function(aPanel_, func_) {
            aPanel_.addEventListener("load", func_, true);
        }, 1, aPanel, func);
    if (!aNoNotification) {
        this.reactorFunc.call(this.reactor);
    }
  },

  onTabRemove: function thst_onTabRemove(aWindow, aPanel, aNoNotification) {
    //TODO: cache the event-handler, refer to it here, and delete it.  Based on panel ID?
    // aPanel.removeEventListener("load", func, true);
    var self = this;
    if (!aNoNotification) {
        this.dump("About to do tab-remove before setTimeout\n", this.log_debug);
        try {
        setTimeout(function(self) {
                this.dump("About to do tab-remove in setTimeout\n", this.log_debug);
            try {
            self.reactorFunc.call(self.reactor);
            } catch(ex) {
                this.dump("Error in onTabRemove handler:\n" + ex + "\n");
            }
        }, 60, self);
        } catch(ex2) {
            this.dump("onTabRemove: Caught exception outside setTimeout" + ex2);
        }
    }
  },

  onTabLoad: function thst_onTabLoad(aWindow, aPanel, aEvent) {
    var self = this;
        try {
    setTimeout(function(self) {
        try {
        self.reactorFunc.call(self.reactor);
        } catch(ex) {
            this.dump("onTabLoad: " + ex + "\n");
        }
    }, 60, self);
        } catch(ex2) {
            this.dump("onTabLoad: Caught exception outside setTimeout; " + ex2);
        }
  },

  onTabMove: function thst_onTabSelect(aWindow, aPanels) {
    this.reactorFunc.call(this.reactor);
  },

  __NULL__ : null
};
