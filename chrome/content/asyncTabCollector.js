/*
** asyncTabCollector.js -- singleton object owned by selectTabDialog.js that gets tabs via frameScript messages
*/

const NEXT_TIMEOUT = 1;
const MAX_NUM_TAB_TRIES = 100;
const TAB_LOADING_WAIT_MS = 50;
const NEXT_TAB_QUERY_DELAY = 100;
const NEXT_TAB_QUERY_HANDOFF = 10; // Before doing the next tab handoff control.

try {

var tabCollector = {};
var globalMessageManager;
(function() {
   const Debug = true;

   var isConnecting = function(s) {
     // Probably a way to look at the tab and figure out if it's connected
     if (!s || s.indexOf("Connecting") != 0) return false;
     return s.match(/Connecting\s*(?:…|\.\.\.)/) || s == "New Tab";
   };

   this.dump = function(aMessage) {
       var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
       .getService(Components.interfaces.nsIConsoleService);
       consoleService.logStringMessage("TH/ATC: " + aMessage);
   };

   this.init = function(_globalMessageManager) {
     this.wmService = (Components.classes["@mozilla.org/appshell/window-mediator;1"].
		       getService(Components.interfaces.nsIWindowMediator));
     if (typeof(globalMessageManager) == "undefined") {
       globalMessageManager = _globalMessageManager;
     }
     globalMessageManager.addMessageListener("tabhunter@ericpromislow.com:docType-has-image-continuation", this.process_docType_has_image_continuation_msg_bound);
     globalMessageManager.addMessageListener("tabhunter@ericpromislow.com:DOMContentLoaded", this.process_DOMContentLoaded_bound);
   };

   this.process_DOMContentLoaded = function() {
     if (Debug) {
       this.dump("**************** sessionTrack -- got a DOMContentLoaded msg from a frame script!");
     }
	gTabhunter.updateOnTabChange();
   };
   this.process_DOMContentLoaded_bound = this.process_DOMContentLoaded.bind(this);
   
   this.onUnload = function() {
     // Called from selectTabDialog.js:onUnload - do this when the tabhunter window is closed.
     globalMessageManager.removeMessageListener("tabhunter@ericpromislow.com:docType-has-image-continuation", this.process_docType_has_image_continuation_msg_bound);
     globalMessageManager.removeMessageListener("tabhunter@ericpromislow.com:DOMContentLoaded", this.process_DOMContentLoaded_bound);
     this.wmService = (Components.classes["@mozilla.org/appshell/window-mediator;1"].
		       getService(Components.interfaces.nsIWindowMediator));
     var openWindows = this.wmService.getEnumerator("navigator:browser");
     do {
	// There must be at least one window for an extension to run in
	var openWindow = openWindows.getNext();
	try {
	   Array.slice(openWindow.getBrowser().tabContainer.childNodes).forEach(function(tab) {
		try {
		   tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:docType-has-image-shutdown", {});
		   tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:content-focus-shutdown", {});
		   tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:search-next-tab-shutdown", {});
		} catch(ex2) {
		   self.dump("Failed to shutdown docType FS: " + ex2);
		}
	     });
	} catch(ex3) {
	   self.dump("Failed to shutdown docType FS: " + ex3);
	}
     } while (openWindows.hasMoreElements());
   };


     // OUT ARGS: tabs: unordered array of [TabInfo]
     //           windowInfo: array of [window: ChromeWindow, tabs: array of [DOM tabs]]   
     this.collectTabs = function(callback) {
       try {
	  this.getTabs_dualProcess(callback);
       } catch(ex) {
	 this.dump('asyncTabCollector.js - collectTabs - ' + ex + "\n" + ex.stack);
       }
     };

     this.dualProcessContinuationFinish = function() {
       if (this.tabGetters.every(function(tabGetter) tabGetter.finishedGettingTabs)) {
	 if (Debug) {
	   this.dump("**** all tabs are done at " + this.timestamp + ", loop over " +
		     this.tabGetters.length + " tabGetters");
	 }
	 this.clearTimeouts();
	 this.dualProcessSetupFinalCallback();
	 return true;
       }
       if (this.tabsToQuery.length > 0) {
	 this.nextTabToQueryTimeout = setTimeout(this.processTabsToQuery.bind(this), NEXT_TAB_QUERY_HANDOFF);
       }
       return false;
     };

     this.dualProcessSetupFinalCallback = function() {
       // pour everything into the return obj and
       // pass it on using the callback
       let result = { tabs:[], windowInfo:[] }
       this.tabGetters.forEach(function(tabGetter) {
	    try {
	       result.tabs = result.tabs.concat(tabGetter.collector.tabs);
	       result.windowInfo.push(tabGetter.collector.currWindowInfo);
	    } catch(e2) {
	       this.dump("**** this.tabGetters.forEach: bad: " + e2);
	    }
	 }.bind(this));
       if (Debug) {
	  this.dump("QQQ: result:tabs: " + result.tabs.length
		    + ", windowInfo: " + result.windowInfo.length);
	  result.tabs.forEach(function(tab) {
	       this.dump("QQQ: window/tab " + tab.windowIdx + "-" + tab.tabIdx + "/" + tab.label + " - " + tab.location);
	    }.bind(this));
       }
       this.tabGetterCallback(result);
     };

     this.clearNextTabQuery = function() {
	 if (this.nextTabToQueryTimeout) {
	   clearTimeout(this.nextTabToQueryTimeout);
	   this.nextTabToQueryTimeout = 0;
	 }
     };
     this.clearCallbackTimeout = function() {
	 if (this.callbackTimeoutId) {
	    clearTimeout(this.callbackTimeoutId);
	    this.callbackTimeoutId = 0;
	 }
     };

     this.clearTimeouts = function() {
	 this.clearCallbackTimeout();
	 this.clearNextTabQuery();
     };

     this.getTabs_dualProcessContinuation = function(msg) {
       let result = this.getTabs_dualProcessContinuation_aux(msg);
       if (result) {
	  this.dualProcessContinuationFinish();
       }
     };
     
     this.getTabs_dualProcessContinuation_aux = function(msg) {
       try {
	 var data = msg.data;
	 var tabIdx = data.tabIdx;
	 var windowIdx = data.windowIdx;
	 var windowTabKey = windowIdx + "-" + tabIdx;

	 if (data.timestamp < this.timestamp) {
	    if (Debug) {
	       this.dump("got a message from an older request " + ((this.timestamp - data.timestamp)) + " msec ago");
	    }
	    return true;
	 }
	 if (this.processedTabs[windowTabKey]) {
	   this.dump("QQQ: we've already processed windowTabKey " + windowTabKey);
	   return true;
	 }
                  
	 var tabGetter = this.tabGetters[windowIdx];
	 if (!tabGetter) {
	    this.dump("Internal Error: Can't get a tabGetter for window " + windowIdx + " (tabIdx " + tabIdx + "), current length: " + this.tabGetters.length);
	    return false;
	 }
	 
	 var hasImage = data.hasImage;
	 var location = data.location;
	 if (Debug) {
	    this.dump("QQQ: getTabs_dualProcessContinuation: " +
		      "windowIdx: " + windowIdx +
		      ", tabIdx: " + tabIdx +
		      ", hasImage: " + hasImage +
		      ", location: " + location +
		      ", this.tabsToQuery.length: " + this.tabsToQuery.length);
		      
	 }
	 var tab = tabGetter.tabs[tabIdx];
	 var label = tab.label;

	 this.processedTabs[windowTabKey] = true;
	 tabGetter.collector.currWindowInfo.tabs.push(tab);
	 var image = tab.getAttribute('image') || '';
	 tabGetter.collector.tabs.push(new ep_extensions.tabhunter.TabInfo(windowIdx, tabIdx, label, image, location));
	 tabGetter.gotTabArray[tabIdx] = true;
	 if (tabGetter.gotTabArray.every(function(x) x)) {
	    this.dump("QQQ: Finished getting tabs for window " + windowIdx);
	    tabGetter.finishedGettingTabs = true;
	 } else {
	    this.dump("QQQ: Still more tabs for window " + windowIdx);
	 }
         return true;
       } catch(e) {
	 this.dump("**** dualProcessContinuation: bad happened: " + e + "\n" + e.stack);
	 return true;
       }
     };

     this.process_docType_has_image_continuation_msg = function(msg) {
       if (Debug) {
	 tabCollector.dump("**** >>> Handling a docType-has-image-continuation notific'n");
	 //tabCollector.dump("**** tabCollector.tabGetters: " + (tabCollector.tabGetters.length + " tabGetters"));
       }
       tabCollector.getTabs_dualProcessContinuation.call(tabCollector, msg);
     };
     this.process_docType_has_image_continuation_msg_bound = this.process_docType_has_image_continuation_msg.bind(this)
         
     this.TabGetter = function(windowIdx, openWindow, tabs) {
       this.windowIdx = windowIdx;
       this.tabs = tabs;
       this.finishedGettingTabs = false;
       this.connectAttempt = 0; // to allow for doc loading
       this.collector = { tabs: [],
			  currWindowInfo: {window: openWindow, tabs: []}};
       this.gotTabArray = new Array(tabs.length);
       for (let i = 0; i < tabs.length; i++) this.gotTabArray[i] = false;
     };
     this.TabGetter.prototype.setImageSetting = function(tabIdx, timestamp) {
       var tab = this.tabs[tabIdx];
       if (Debug) {
	 this.dump("**** go do docType-has-image for windowIdx " +
		   this.windowIdx + ", tabIdx: " + tabIdx + " <" + tab.label + ">");
       }
       tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:docType-has-image", { tabIdx: tabIdx, windowIdx: this.windowIdx, timestamp:timestamp });
     };

     this.TabGetter.prototype.dump = function(aMessage) {
       var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
       .getService(Components.interfaces.nsIConsoleService);
       consoleService.logStringMessage("TH/ATC/TabGetter: " + aMessage);
     };

     this.getTabs_dualProcess = function(callback) {
       // Get all the windows with tabs synchronously. Then get the
       // image info for each tab asynchronously, knit everything
       // together, and send the result back via the callback.
       this.clearTimeouts();
       var openWindows = this.wmService.getEnumerator("navigator:browser");
       var windowIdx = -1;
       this.tabGetters = [];
       this.tabGetterCallback = callback;
       this.processedTabs = {}; // hash "windowIdx-tabIdx : true"
       this.timestamp = new Date().valueOf();

       this.tabsToQuery = []; // Array of {windowIdx, tabIdx, openWindow}
       // Get the eligible windows
       var numTabs = 0;
       do {
	  // There must be at least one window for an extension to run in
	  var openWindow = openWindows.getNext();
	  try {
	     var tc = openWindow.getBrowser().tabContainer.childNodes;
	     numTabs += tc.length;
	     this.dump("Window #" + (windowIdx + 1) + " has # tabs: " + tc.length);
	  } catch(ex) {
	     continue;
	  }
	  windowIdx += 1;
	  this.tabGetters.push(new this.TabGetter(windowIdx, openWindow, tc));
	  for (let i = 0; i < tc.length; i++) {
	     this.tabsToQuery.push({windowIdx:windowIdx, tabIdx:i, openWindow:openWindow});
	  }
       } while (openWindows.hasMoreElements());
       this.dump("TH: getTabs_dualProcess: #this.tabsToQuery: " + this.tabsToQuery.length);
       this.processTabsToQuery();
       let timeoutTabFactor = 10000;  // Yes, allow 10 seconds per tab
       let timeoutWindowFactor = 2000;
       let totalTimeout = timeoutTabFactor * numTabs + timeoutWindowFactor * windowIdx;
       let callbackTimeoutFunc = function() {
	 this.dump("**** Hit callback timeout (" + (totalTimeout/1000) + " sec. before getting all the tabs -- " + this.tabsToQuery.length + " left to process");
	 this.clearTimeouts();
	 this.dualProcessSetupFinalCallback();
	 // Maybe we'll get more later...
	 this.callbackTimeoutId = setTimeout(callbackTimeoutFunc, totalTimeout);
	 if (this.tabsToQuery.length > 0) {
	    this.processTabsToQuery();
	 }
       }.bind(this);
       setTimeout(callbackTimeoutFunc, totalTimeout);
     };
       
     this.processTabsToQuery = function() {
       if (this.tabsToQuery.length == 0) {
	 this.dump("TH: processTabsToQuery: this.tabsToQuery is empty");
	 return;
       }
       this.dump("TH: #this.tabsToQuery: " + this.tabsToQuery.length);
       var workItem = this.tabsToQuery.shift();
       //this.dump("QQQ: processTabsToQuery: workItem: " + (workItem && Object.keys(workItem).join(", ")))
       //this.dump("QQQ: processTabsToQuery: workItem: " + (workItem && Object.keys(workItem).join(", ")))
       this.tabGetters[workItem.windowIdx].setImageSetting(workItem.tabIdx, this.timestamp);
     };

   }).apply(tabCollector);

} catch(e) {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage("th/tabCollector startup: " + e);
        consoleService.logStringMessage("th/tabCollector failure stack: " + e.stack);
}

