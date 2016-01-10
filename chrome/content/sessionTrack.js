// Copyright (C) Eric Promislow 2008.  All Rights Reserved.
// See full license in tabhunter.js

/* :::::::: Constants and Helpers ::::::::::::::: */

var globalMessageManager, Cc, Ci;
const TAB_REMOVE_DELAY_TIME = 500; // ms

if (typeof(Cc) === "undefined") {
    var Cc = Components.classes;
    var Ci = Components.interfaces;
}

if (typeof(globalMessageManager) == "undefined") {
   globalMessageManager = (function() {
        try {
            return Cc["@mozilla.org/globalmessagemanager;1"].getService(Ci.nsIMessageListenerManager);
        } catch(ex) {
            return false;
        }
     })();
}

// global notifications observed
const OBSERVING = [
		   "domwindowopened",
		   "domwindowclosed",
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

  forAllWindows: function(cb) {
    // watch the current windows
    var  wmService = (Components.classes["@mozilla.org/appshell/window-mediator;1"].
                      getService(Components.interfaces.nsIWindowMediator));
    
    var openWindows = wmService.getEnumerator("navigator:browser");
    while(openWindows.hasMoreElements()) {
        cb(openWindows.getNext());
    }
   },

  /**
   * Initialize the component
   */
  init: function thst_init() {

    this.eventHandlerWrapper_bound = this.eventHandlerWrapper.bind(this);
    var observerService = Cc["@mozilla.org/observer-service;1"].
                          getService(Ci.nsIObserverService);

    OBSERVING.forEach(function(aTopic) {
      observerService.addObserver(this, aTopic, false);
    }, this);
    var self = this;
    this.forAllWindows(function(aWindow) {
	 self.onLoad(aWindow, true);
      });
  
    this.onLoadWrapper_bound = this.onLoadWrapper.bind(this);
  },

  onLoadWrapper: function(aEvent) {
     return this.onLoad(aEvent.currentTarget, false);
   },

  onUnload: function() {
    var observerService = Cc["@mozilla.org/observer-service;1"].
                          getService(Ci.nsIObserverService);

    OBSERVING.forEach(function(aTopic) {
      observerService.removeObserver(this, aTopic, false);
    }, this);
    var self = this;
    this.forAllWindows(function(aWindow) {
	 self.onClose(aWindow, false);
      });
   },

  /**
   * Handle notifications
   */
  observe: function thst_observe(aSubject, aTopic, aData) {
    // for event listeners
    var self = this;

    //this.dump(">> QQQ: sessionTrack observed topic " + aTopic + ", subject: " + aSubject + ", data: " + aData);
    switch (aTopic) {
    case "domwindowopened": // catch new windows
        self.onLoad(aSubject, false);
        try {
	   aSubject.addEventListener("load", self.onLoadWrapper_bound, false);
        } catch(ex) {
            this.dump("observe:domwindowopened: " + ex)
        }
      break;
    case "domwindowclosed": // catch closed windows
      aSubject.removeEventListener("load", this.onLoadWrapper_bound, false);
      this.onClose(aSubject, true);
      break;
    }
  },

/* ........ Window Event Handlers .............. */

  /**
   * Implement nsIDOMEventListener for handling various window and tab events
   */
  handleEvent: function thst_handleEvent(aEvent) {
     //this.dump("**** handleEvent " + aEvent.type);
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
          this.onTabAdd(aEvent.currentTarget.ownerDocument.defaultView, tabpanel,
                        
                        aEvent.originalTarget, false);
        }
        else {
	  this.onTabRemove(aEvent.currentTarget.ownerDocument.defaultView, tabpanel, aEvent.originalTarget, false);
        }
        break;
      case "TabMove":
        var tabpanels = aEvent.currentTarget.mPanelContainer;
        this.onTabMove(aEvent.currentTarget.ownerDocument.defaultView, tabpanels);
        break;
    }
  },

  eventHandlerWrapper: function(aEvent) {
     this.handleEvent(aEvent);
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
    var limit = Math.max(tabpanels.childNodes.length,
                         tabContainer.childNodes.length);
    for (var i = 0; i < limit; i++) {
        //this.dump("QQQ - sessionTrack.js: onTabAdd(" + i + ")");
        this.onTabAdd(aWindow, tabpanels.childNodes[i],
                      tabContainer.childNodes[i], true);
    }
    // notification of tab add/remove/selection
    var self = this;
    setTimeout(function() {
            tabContainer.addEventListener("TabOpen", self.eventHandlerWrapper_bound, false);
            tabContainer.addEventListener("TabClose", self.eventHandlerWrapper_bound, false);
            tabContainer.addEventListener("TabMove", self.eventHandlerWrapper_bound, false);
        }, 1);
    if (!aNoNotification) {
        this.reactorFunc.call(this.reactor);
    } else {
    }
  },

  onClose: function thst_onClose(aWindow, updateTabs) {
     if (typeof(updateTabs) == "undefined") {
       updateTabs = true;
     }
     if (aWindow.browserDOMWindow === null) {
       //this.dump("closing a non-browser-dom window, ignoring the event");
       return;
     }
     if (updateTabs) {
       this.reactorFunc.call(this.reactor);
     }
    //XXX: Figure out why this doesn't work.
    if (!aWindow || typeof(aWindow.getBrowser) != 'function') return;
    var tabbrowser = aWindow.getBrowser();
    if (tabbrowser) {
        // It might be gone already.
        var tabContainer = tabbrowser.tabContainer;
        var tabpanels = tabbrowser.mPanelContainer;
    
        tabContainer.removeEventListener("TabOpen", this.eventHandlerWrapper_bound, false);
        tabContainer.removeEventListener("TabClose", this.eventHandlerWrapper_bound, false);
        tabContainer.removeEventListener("TabMove", this.eventHandlerWrapper_bound, false);
        
        for (var i = 0; i < tabpanels.childNodes.length; i++) {
	   this.onTabRemove(aWindow, tabpanels.childNodes[i], null, true);
        }
    }
  },

  onTabAdd: function thst_onTabAdd(aWindow, aPanel, aTab, aNoNotification) {
     // this.dump(">>>>>>>>>>>>>>>> sessionTrack.js:onTabAdd, aNoNotification: " + aNoNotification)
     if (!this.eventHandlerWrapper_bound) {
       this.dump("this.eventHandlerWrapper_bound is null ... quit");
       return;
     }
    if (aTab) {
        try {
            var mm = aTab.linkedBrowser.messageManager;
            if (mm) {
	       //this.dump("-QQQ: loading the linkedBrowser frame scripts...")
                mm.loadFrameScript("chrome://tabhunter/content/frameScripts/browser-window-focus.js", true);
                mm.loadFrameScript("chrome://tabhunter/content/frameScripts/search-next-tab.js", true);
                mm.loadFrameScript("chrome://tabhunter/content/frameScripts/docType-has-image.js", true);
                //this.dump("+QQQ: loading the linkedBrowser frame scripts...")
            }
        } catch(ex) {
            this.dump("Failed to load 1 or more frame scripts: " + ex + "\n" + ex.stack);
        }
    } else {
      // this.dump("**** Don't add frame scripts for panel " + aPanel.id);
    }
    aPanel.addEventListener("load", this.eventHandlerWrapper_bound, true);
     if (!aNoNotification) {
	setTimeout(function() {
	     this.reactorFunc.call(this.reactor);
	  }.bind(this), 3000)
     }
  },

  onTabRemove: function thst_onTabRemove(aWindow, aPanel, aTab, aNoNotification) {
    //TODO: cache the event-handler, refer to it here, and delete it.  Based on panel ID?
    aPanel.removeEventListener("load", this.eventHandlerWrapper_bound, true);
    var self = this;
    if (!aNoNotification) {
       //this.dump("About to do tab-remove before setTimeout\n", this.log_debug);
        try {
            var mm = aTab.linkedBrowser.messageManager;
            if (mm) {
	       mm.sendAsyncMessage("tabhunter@ericpromislow.com:docType-has-image-shutdown", {});
	       mm.sendAsyncMessage("tabhunter@ericpromislow.com:content-focus-shutdown", {});
	       mm.sendAsyncMessage("tabhunter@ericpromislow.com:search-next-tab-shutdown", {});
	    }	   
	    setTimeout(function(self) {
		 //self.dump("About to do tab-remove in setTimeout\n", self.log_debug);
		 try {
		    self.reactorFunc.call(self.reactor);
		 } catch(ex) {
		    self.dump("Error in onTabRemove handler:\n" + ex + "\n");
		 }
	      }, TAB_REMOVE_DELAY_TIME, self);
        } catch(ex2) {
	   this.dump("onTabRemove: Caught exception outside setTimeout" + ex2);
        }
    }
  },

  onTabLoad: function thst_onTabLoad(aWindow, aPanel, aEvent) {
     // this.dump("QQQ > **** sessionTrack.js: >>onTabLoad")
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
