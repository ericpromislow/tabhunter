// Frame script for focusing a targetBrowser's contentWindow

var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
//consoleService.logStringMessage("-Loading browser-window-focus.js...");


var handleMessage = function(message) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage("Got the message to load");
    try {
        content.focus();
    } catch(e) {
        consoleService.logStringMessage("Bad happened: " + e);
    }
};

addMessageListener("tabhunter@ericpromislow.com:content-focus", handleMessage);
var handleStopListeningMessage = function(msgData) {
  var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
  consoleService.logStringMessage("RRR: Stop listening for content-focus");
  removeMessageListener("tabhunter@ericpromislow.com:content-focus", handleMessage);
  removeMessageListener("tabhunter@ericpromislow.com:content-focus-shutdown", handleMessage);
}

addMessageListener("tabhunter@ericpromislow.com:content-focus-shutdown", handleStopListeningMessage);
