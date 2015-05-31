// Frame script for focusing a targetBrowser's contentWindow


try {
    content.focus();
} catch(e) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
        .getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage("Bad happened: " + e);
}
