/*
** asyncTabCollector.js -- singleton object owned by selectTabDialog.js that gets tabs via frameScript messages
*/

const NEXT_TIMEOUT = 1;
const MAX_NUM_TAB_TRIES = 100;
const TAB_LOADING_WAIT_MS = 50;
const NEXT_TAB_QUERY_DELAY = 100;
const NEXT_TAB_QUERY_HANDOFF = 10; // Before doing the next tab handoff control.

const GET_TABS_ITERATE_DELAY = 1; // msec

try {

var tabCollector = {};
var globalMessageManager;
(function() {
   const Debug = false;

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
     this.lastGoodTabGetters = [];
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
       this.lastGoodTabGetters = this.tabGetters;
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
	   if (Debug) {
	   this.dump("QQQ: we've already processed windowTabKey " + windowTabKey);
	   }
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
	   if (Debug) {
	    this.dump("QQQ: Finished getting tabs for window " + windowIdx);
	   }
	    tabGetter.finishedGettingTabs = true;
	 } else {
	   if (Debug) {
	    this.dump("QQQ: Still more tabs for window " + windowIdx);
	   }
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
       
       this.tabGetterCallback = callback;
       this.processedTabs = {}; // hash "windowIdx-tabIdx : true"
       this.timestamp = new Date().valueOf();

       this.tabsToQuery = []; // Array of {windowIdx, tabIdx, openWindow}
       // Get the eligible windows
       let nextWindow = openWindows.getNext();
       let tc = nextWindow.getBrowser().tabContainer.childNodes;
       this.numTabs = tc.length;
       if (Debug) {
       this.dump("QQQ: Window #1 has # tabs: " + tc.length);
       }
       
       // tabGetters: array of { tabs:[]"real" tabs, collector: {tabs:[]TabInfo, currWindowInfo: {window:openWindow, tabs:"real" []}  Really Eric -- 3 fields called "tabs"??
       this.tabGetters = [new this.TabGetter(0, nextWindow, tc)];
       this.madeRequest = false;

       this.getNextTabFuncBound(this.timestamp, openWindows, nextWindow, tc, 0, 0);
     };

     // loops considered harmful in JS: use short-duration timeouts
     this.getNextTabFunc = function(timestamp, openWindows, openWindow, tc, windowIdx, tabIdx) {
       if (this.timestamp > timestamp) {
	 // A new query-loop started, so end this one.
	 // No need to cancel anything
	 if (Debug) {
	   this.dump("**** getNextTabFunc: processing a newer query at windowIdx: " +
		     this.windowIdx + ", tabIdx: " + tabIdx + " expired " +
		     (this.timestamp - timestamp) + " msec ago");
	 }
	 return;
       }
       let makeRequest = true;
       let lastGoodTabGetter = this.lastGoodTabGetters[windowIdx];
       if (lastGoodTabGetter) {
	  let realTab = lastGoodTabGetter.tabs[tabIdx];
	  if (realTab && realTab.label == tc[tabIdx].label) {
	     // Can't check for location match (because we have to send the frame script
	     // a message, so assume if the label hasn't changed on the tab, it's good.
	     let realCollector = lastGoodTabGetter.collector;
	     let realTabInfo = realCollector.tabs[tabIdx];
	     if (realTabInfo) {
		if (Debug) {
		this.dump("QQQ: No need to update tab " + realTab.label + ", windowIdx" +
			  windowIdx + ", tabIdx: " + tabIdx);
		//this.dump("QQQ: windowMatch: " + (lastGoodTabGetter.collector.openWindow == openWindow));
		//this.dump("QQQ: tabMatch: " + (realTab == tc[tabIdx]));
		}
		// So update the tab collector directly
		try {
		let data = {tabIdx:tabIdx,
			    windowIdx:windowIdx,
			    timestamp:timestamp,
			    hasImage:false, // not kept
			    location:realTabInfo.location};
		   this.getTabs_dualProcessContinuation_aux({data: data});
		   makeRequest = false;
		} catch(ex) {
		   //@@@@
		   this.dump("QQQ: Problem trying to update known tab: windowIdx:" + windowIdx +
			     " tabIdx: " + tabIdx + "ex: " + ex + "ex.stack:" + ex.stack);
		this.dump("QQQ: No need to update tab " + realTab.label + ", windowIdx" +
			  windowIdx + ", tabIdx: " + tabIdx);
		this.dump("QQQ: windowMatch: " + (lastGoodTabGetter.collector.openWindow == openWindow));
		this.dump("QQQ: tabMatch: " + (realTab == tc[tabIdx]));
		this.dump("QQQ: tabGetter tab: <" + this.tabGetters[windowIdx].tabs[tabIdx] + ">");
		}
	     } else {
		//this.dump("QQQ: No realTabInfo");
	     }
	  } else {
	     //this.dump("QQQ: No real-tab label match");
	  }
       } else {
	 //this.dump("QQQ: No last goodTabGetter");
       }
       if (makeRequest) {
	 this.madeRequest = true;
	 this.tabsToQuery.push({windowIdx:windowIdx, tabIdx:tabIdx, openWindow:openWindow});
       }
       if (tabIdx < tc.length - 1) {
	  setTimeout(this.getNextTabFuncBound, GET_TABS_ITERATE_DELAY, timestamp, openWindows, openWindow, tc, windowIdx, tabIdx + 1);
       } else if (openWindows.hasMoreElements()) {
	 let nextWindow = openWindows.getNext();
	 let tc = nextWindow.getBrowser().tabContainer.childNodes;
	 let nextWindowIdx = windowIdx + 1;
	 this.tabGetters.push(new this.TabGetter(nextWindowIdx, nextWindow, tc));
	 this.numTabs += tc.length;
	 if (Debug) {
	    this.dump("Window #" + nextWindowIdx + " has # tabs: " + tc.length);
	 }
	 setTimeout(this.getNextTabFuncBound, GET_TABS_ITERATE_DELAY, timestamp, openWindows, nextWindow, tc, nextWindowIdx, 0);
       } else {
	 // We've visited all the tabs, now go start processing each one.
	 // This function ends by sending a message to a frame script
	 if (!this.madeRequest) {
	   // Call the final processor directly
	   if (Debug) {
	   this.dump("QQQ: No requests were made, so call dualProcessContinuationFinish directly")
	   }
	   this.dualProcessContinuationFinish();
	   return;
	 }
	 this.processTabsToQuery();

	 // And set up the timeout to keep processing tabsToQuery if the current
	 // frame script doesn't respond.
	 let timeoutTabFactor = 10000;  // Yes, allow 10 seconds per tab
	 let timeoutWindowFactor = 2000;
	 let totalTimeout = timeoutTabFactor * this.numTabs + timeoutWindowFactor * windowIdx;
	 let callbackTimeoutFunc = function() {
	   if (Debug) {
	   this.dump("**** Hit callback timeout (" + (totalTimeout/1000) + " sec. before getting all the tabs -- " + this.tabsToQuery.length + " left to process");
	   }
	   this.clearTimeouts();
	   this.dualProcessSetupFinalCallback();
	   // Maybe we'll get more later...
	   this.callbackTimeoutId = setTimeout(callbackTimeoutFunc, totalTimeout);
	   if (this.tabsToQuery.length > 0) {
	      this.processTabsToQuery();
	   }
	 }.bind(this);
	 setTimeout(callbackTimeoutFunc, totalTimeout);
       }
     };

     this.getNextTabFuncBound = this.getNextTabFunc.bind(this);
       
     this.processTabsToQuery = function() {
       if (this.tabsToQuery.length == 0) {
	 this.dump("TH: processTabsToQuery: this.tabsToQuery is empty");
	 return;
       }
       if (Debug) {
       this.dump("TH: #this.tabsToQuery: " + this.tabsToQuery.length);
       }
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

