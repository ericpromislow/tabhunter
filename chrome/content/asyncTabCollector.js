/*
** asyncTabCollector.js -- singleton object owned by selectTabDialog.js that gets tabs via frameScript messages
*/

const NEXT_TIMEOUT = 1;
const MAX_NUM_TAB_TRIES = 100;
const TAB_LOADING_WAIT_MS = 50;

try {

var tabCollector = {};
var globalMessageManager;
(function() {
   var isConnecting = function(s) {
     // Probably a way to look at the tab and figure out if it's connected
     if (!s || s.indexOf("Connecting") != 0) return false;
     return s.match(/Connecting\s*(?:…|\.\.\.)/) || s == "New Tab";
   };

   this.init = function(_globalMessageManager) {
     this.wmService = (Components.classes["@mozilla.org/appshell/window-mediator;1"].
		       getService(Components.interfaces.nsIWindowMediator));
     if (typeof(globalMessageManager) == "undefined") {
       globalMessageManager = _globalMessageManager;
     }
     globalMessageManager.addMessageListener("tabhunter@ericpromislow.com:docType-has-image-continuation", this.process_docType_has_image_continuation_msg);
     globalMessageManager.addMessageListener("tabhunter@ericpromislow.com:DOMContentLoaded", this.process_DOMContentLoaded);
   };

   this.process_DOMContentLoaded = function() {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
	  .getService(Components.interfaces.nsIConsoleService).logStringMessage("**************** sessionTrack -- got a DOMContentLoaded msg from a frame script!");
	gTabhunter.updateOnTabChange();
   };
   
   this.onUnload = function() {
     // Called from selectTabDialog.js:onUnload - do this when the tabhunter window is closed.
     this.dump("!!!!!!!!!!!!!!!! asyncTabCollector.js:onUnload - removing message listeners!!!!!!!!!!!!!!!!");
     globalMessageManager.removeMessageListener("tabhunter@ericpromislow.com:docType-has-image-continuation", this.process_docType_has_image_continuation_msg);
     globalMessageManager.removeMessageListener("tabhunter@ericpromislow.com:DOMContentLoaded", this.process_DOMContentLoaded);
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
		   self.dump("QQQ !!! Failed to shutdown docType FS: " + ex2);
		}
	     });
	} catch(ex3) {
	   self.dump("QQQ !!! Failed to shutdown docType FS: " + ex3);
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
       if (!this.tabGetters.every(function(tabGetter) tabGetter.finishedGettingTabs)) {
	 return false;
       }
       this.dump("**** all tabs are done at " + this.timestamp + ", loop over " +
		 this.tabGetters.length + " tabGetters");
       clearTimeout(this.callbackTimeoutId);
       this.dualProcessSetupFinalCallback();
       return true;
     };

     this.dualProcessSetupFinalCallback = function() {
       // pour everything into the return obj and
       // pass it on using the callback
       let result = { tabs:[], windowInfo:[] }
       this.tabGetters.forEach(function(tabGetter) {
	    try {
	       this.dump("QQQ: concat in " + tabGetter.collector.tabs.length + " tabs");
	       result.tabs = result.tabs.concat(tabGetter.collector.tabs);
	       this.dump("QQQ: result.windowInfo.push: " + tabGetter.collector.currWindowInfo);
	       result.windowInfo.push(tabGetter.collector.currWindowInfo);
	    } catch(e2) {
	       this.dump("**** this.tabGetters.forEach: bad: " + e2);
	    }
	 }.bind(this));
       this.dump("QQQ: result:tabs: " + result.tabs.length
		 + ", windowInfo: " + result.windowInfo.length);
       result.tabs.forEach(function(tab) {
	    this.dump("QQQ: window/tab " + tab.windowIdx + "-" + tab.tabIdx + "/" + tab.label + " - " + tab.location);
	 }.bind(this));
       this.dump("QQQ: getTabs_dualProcessContinuationFinish: this.tabGetterCallback = " + typeof(this.tabGetterCallback));
       this.tabGetterCallback(result);
     };

     this.getTabs_dualProcessContinuation = function(msg) {
       try {
	 var data = msg.data;
	 var tabIdx = data.tabIdx;
	 var windowIdx = data.windowIdx;
	 var windowTabKey = windowIdx + "-" + tabIdx;
	 
	 if (data.timestamp < this.timestamp) {
	   this.dump("QQQ: got a message from an older request " + ((this.timestamp - data.timestamp) * 1000) + " msec ago");
	   return;
	 }
	 if (this.processedTabs[windowTabKey]) {
	   this.dump("QQQ: we've already processed windowTabKey " + windowTabKey);
	   this.dualProcessContinuationFinish();
	   return;
	 }
	 var hasImage = data.hasImage;
	 var location = data.location;
	 this.dump("QQQ: getTabs_dualProcessContinuation: tabIdx: " + tabIdx +
		   ", windowIdx: " + windowIdx +
		   ", hasImage: " + hasImage +
		   ", location: " + location);
                  
	 var tabGetter = this.tabGetters[windowIdx];
	 if (!tabGetter) {
	    this.dump("!!!! Can't get a tabGetter for window " + windowIdx + " (tabIdx " + tabIdx + "), current length: " + this.tabGetters.length);
	    return;
	 }
	 //RRR this.dump("QQQ: windowIdx: " + windowIdx + ", tabGetter: " + tabGetter);
	 var tab = tabGetter.tabs[tabIdx];
	 var label = tab.label;
	 if (isConnecting(label) && location == "about:blank" && tabGetter.connectAttempt < MAX_NUM_TAB_TRIES) {
           this.dump("QQQ: Go reload window -- about:blank tabGetter.connectAttempt: " + tabGetter.connectAttempt);
           tabGetter.connectAttempt += 1;
           setTimeout(function(timestamp) {
                tabGetter.setImageSetting(tabIdx, timestamp);
             }, TAB_LOADING_WAIT_MS, this.timestamp);
           return;
        }

	 this.processedTabs[windowTabKey] = true;
	 tabGetter.collector.currWindowInfo.tabs.push(tab);
	 var image = tab.getAttribute('image') || '';
	 tabGetter.collector.tabs.push(new ep_extensions.tabhunter.TabInfo(windowIdx, tabIdx, label, image, location));
	 tabGetter.gotTabArray[tabIdx] = true;
	 if (tabGetter.gotTabArray.every(function(x) x)) {
	    tabGetter.finishedGettingTabs = true;
	    this.dualProcessContinuationFinish();
	 }
       } catch(e) {
	 this.dump("**** dualProcessContinuation: bad happened: " + e + "\n" + e.stack);
       }
     };

     this.process_docType_has_image_continuation_msg = function(msg) {
       tabCollector.dump("**** >>> Handling a docType-has-image-continuation notific'n");
       tabCollector.dump("**** tabCollector.tabGetters: " + (tabCollector.tabGetters.length + " tabGetters")); 
       tabCollector.getTabs_dualProcessContinuation.call(tabCollector, msg);
     };
         
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
       var self = this;
       var attempt = 0;
       var checkForConnectedTabFunc = function() {
	 self.dump("**** go do docType-has-image for windowIdx " +
		   self.windowIdx + ", tabIdx: " + tabIdx + " <" + tab.label + ">");
	 if (isConnecting(tab.label) && attempt < MAX_NUM_TAB_TRIES) {
	    attempt += 1;
	    setTimeout(checkForConnectedTabFunc, TAB_LOADING_WAIT_MS);
	 } else {
	   tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:docType-has-image", { tabIdx: tabIdx, windowIdx: self.windowIdx, timestamp:timestamp });
	 }
       }
       checkForConnectedTabFunc();
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
       var openWindows = this.wmService.getEnumerator("navigator:browser");
       var windowIdx = -1;
       this.tabGetters = [];
       this.tabGetterCallback = callback;
       this.processedTabs = {}; // hash "windowIdx-tabIdx : true"
       this.timestamp = new Date().valueOf();
       // Get the eligible windows
       var numTabs = 0;
       do {
	  // There must be at least one window for an extension to run in
	  var openWindow = openWindows.getNext();
	  try {
	     var tc = openWindow.getBrowser().tabContainer.childNodes;
	     numTabs += tc.length;
	  } catch(ex) {
	     continue;
	  }
	  windowIdx += 1;
	  this.dump("**** setup TabGetter(" + windowIdx + ")");
	  this.tabGetters.push(new this.TabGetter(windowIdx, openWindow, tc));
	  for (let i = 0; i < tc.length; i++) {
	     this.tabGetters[windowIdx].setImageSetting(i, this.timestamp);
	  }
       } while (openWindows.hasMoreElements());
       let timeoutTabFactor = 500;
       let timeoutWindowFactor = 2000;
       let totalTimeout = timeoutTabFactor * numTabs + timeoutWindowFactor * windowIdx;
       this.callbackTimeoutId = setTimeout(function() {
	    this.dump("**** Hit callback timeout (" + (totalTimeout/1000) + " sec. before getting all the tabs ");
	    this.dualProcessSetupFinalCallback();
	 }.bind(this), totalTimeout);

     };

     
     this.dump = function(aMessage) {
       var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
       .getService(Components.interfaces.nsIConsoleService);
       consoleService.logStringMessage("TH/ATC: " + aMessage);
     };

   }).apply(tabCollector);

} catch(e) {
        var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
                                       .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage("th/tabCollector startup: " + e);
        consoleService.logStringMessage("th/tabCollector failure stack: " + e.stack);
}
