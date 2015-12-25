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
     this.dump("QQQ: Stop listening on docType-has-image-continuation");
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
       this.dump("**************** HEYYYA we're collecting");
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
		 this.tabGetters.length + " tabs");
       clearTimeout(this.callbackTimeoutId);
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
       //TODO: XXX: dump result here, as it's coming back empty.
       this.tabGetterCallback(result);
       return true;
     };

     this.getTabs_dualProcessContinuation = function(msg) {
       try {
	 var data = msg.data;
	 var tabIdx = data.tabIdx;
	 var windowIdx = data.windowIdx;
	 var windowTabKey = windowIdx + "-" + tabIdx;
	 if (!this.tabGetters) {
	    this.dump(">> getTabs_dualProcessContinuation unexpected:!this.tabGetters, ignore, windowTabKey:" + windowTabKey.substr(0, 40) + ", timestamp:" + this.timestamp);
	    var s = [];
	    var funcCount = 0;
	    for (var p in this) {
	       if (typeof(this[p]) != "function") s.push(p);
	       else if (funcCount == 0) {
		  s.push(p);
		  funcCount += 1;
	       }
	    }
	    if (this.tabGetterCallback) {
	       s.push("tabGetterCallback");
	    }
	    this.dump("props of this: " + s.join(" "));
	    return;
	 }
	 //this.dump(">> getTabs_dualProcessContinuation: msg: " + Object.keys(msg).join(" "));
	 // this.dump(">> getTabs_dualProcessContinuation: data: " + Object.keys(data).join(" "));
	 //this.dump("QQQ: and keys(this): " + Object.keys(this).join(" "));
	 if (data.timestamp < this.timestamp) {
	   this.dump("QQQ: got a message from an older request " + ((this.timestamp - data.timestamp)/1000000.0) + " msec ago");
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
	 //RRR this.dump("QQQ: windowIdx: " + windowIdx + ", tabGetter: " + tabGetter);
	 var tab = tabGetter.tabs[tabIdx];
	 var label = tab.label;
	 if (location == "about:blank" && tabGetter.connectAttempt < MAX_NUM_TAB_TRIES) {
	    this.dump("QQQ: !!!! Wait to reload window -- about:blank tabGetter.connectAttempt: " + tabGetter.connectAttempt);
	    tabGetter.connectAttempt += 1;
	    setTimeout(function(timestamp) {
		 tabGetter.setImageSetting(tabIdx, timestamp);
	      }, TAB_LOADING_WAIT_MS, this.timestamp);
	    return;
	 }
	 this.processedTabs[windowTabKey] = true;
	 //RRR this.dump("QQQ: tabGetter.collector.currWindowInfo: " + Object.keys(tabGetter.collector.currWindowInfo).join(", "));
	 //RRR this.dump("QQQ: tabGetter.collector.currWindowInfo.tabs: " + Object.prototype.toString.call(tabGetter.collector.currWindowInfo.tabs));
	 tabGetter.collector.currWindowInfo.tabs.push(tab);
	 //var image = data.hasImage ? tab.getAttribute('image') : '';
	 var image = tab.getAttribute('image') || '';
	 tabGetter.collector.tabs.push(new ep_extensions.tabhunter.TabInfo(windowIdx, tabIdx, label, image, location));
	 this.dump("QQQ: collector for window " + windowIdx +
		   ", now has " + tabGetter.collector.tabs.length + " tabs");
	 if (tabIdx < tabGetter.tabs.length - 1) {
	    setTimeout(function() {
		 this.dump("QQQ: go get location/image for window " + windowIdx +
			   ", tab " + (tabIdx + 1) + ", title:" + tabGetter.tabs[tabIdx + 1].label + ", ts " + this.timestamp);
		 tabGetter.setImageSetting(tabIdx + 1, this.timestamp);
	      }.bind(this), NEXT_TIMEOUT);
	 } else {
	   this.dump("**** dualProcessContinuation: all done with window " + windowIdx);
	   tabGetter.finishedGettingTabs = true;
	   if (!this.dualProcessContinuationFinish()) {
	      this.dump("**** continue on with TabGetter(" + (windowIdx + 1) + ")");
	      this.tabGetters[windowIdx + 1].setImageSetting(0, this.timestamp);
	   }
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
     };
     this.TabGetter.prototype.isConnecting = function(s) {
       if (!s || s.indexOf("Connecting") != 0) return false;
       return s.match(/Connecting\s*(?:…|\.\.\.)/);
     }  
     this.TabGetter.prototype.setImageSetting = function(tabIdx, timestamp) {
       var tab = this.tabs[tabIdx];
       this.dump("**** go do docType-has-image for windowIdx " +
				    this.windowIdx + ", tabIdx: " + tabIdx + " <" + tab.label + ">");
       var windowIdx = this.windowIdx;
       var self = this;
       var loadReadyTabFunc = function() {
	 if (self.isConnecting(tab.label) && self.connectAttempt < MAX_NUM_TAB_TRIES) {
	   self.dump("**** don't like tab.label " + tab.label + " at attempt " + self.connectAttempt);
	   self.connectAttempt += 1;
	   setTimeout(loadReadyTabFunc, TAB_LOADING_WAIT_MS);
	   return;
	 }
	 tab.linkedBrowser.messageManager.sendAsyncMessage("tabhunter@ericpromislow.com:docType-has-image", { tabIdx: tabIdx, windowIdx: windowIdx, timestamp:timestamp });
       };
       loadReadyTabFunc();
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
       do {
	  // There must be at least one window for an extension to run in
	  var openWindow = openWindows.getNext();
	  try {
	     var tc = openWindow.getBrowser().tabContainer.childNodes;
	  } catch(ex) {
	     continue;
	  }
	  windowIdx += 1;
	  this.dump("**** setup TabGetter(" + windowIdx + ")");
	  this.tabGetters.push(new this.TabGetter(windowIdx, openWindow, tc));
       } while (openWindows.hasMoreElements());
       this.tabGetters[0].setImageSetting(0, this.timestamp);
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
