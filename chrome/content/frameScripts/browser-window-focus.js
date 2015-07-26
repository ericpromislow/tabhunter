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
// No need to remove the message-listener when the tab is removed as we won't be
// getting any messages on it.

// This fires, so all the frame scripts have been loaded.
//consoleService.logStringMessage("+ Loaded browser-window-focus.js.");
