// Frame script for seeing if a document has an image

var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);

 handleMessage = function(msgData) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
    try {
        doStuff(msgData.data);
    } catch(e) {
        consoleService.logStringMessage("Bad happened: " + e);
    }
};

function doStuff(data) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
    // Send all data back, along with the result
    data.hasImage = content.document.contentType.indexOf("image/") >= 0;
    data.location = content.document.location.toString();
    consoleService.logStringMessage("RRR: doc FS got location: " + data.location.substr(0, 40) + ", hasImage:" + data.hasImage);
    sendAsyncMessage("tabhunter@ericpromislow.com:docType-has-image-continuation", data);
}

var handleStopListeningMessage = function(msgData) {
  var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
  consoleService.logStringMessage("RRR: Stop listening for docType-has-image and stop-listening");
  removeMessageListener("tabhunter@ericpromislow.com:docType-has-image", handleMessage);
}

addMessageListener("tabhunter@ericpromislow.com:docType-has-image", handleMessage);
addMessageListener("tabhunter@ericpromislow.com:docType-has-image-shutdown", handleStopListeningMessage);

consoleService.logStringMessage("+ Done Loading docType-has-image.js...");
