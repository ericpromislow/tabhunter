// Frame script for seeing if a document has an image

var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
//consoleService.logStringMessage("-Loading docType-has-image.js...");

 handleMessage = function(msgData) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
    try {
       //        consoleService.logStringMessage("RRR: -doStuff(msgData.data: " + Object.keys(msgData.data).join(" ") + ")");
        doStuff(msgData.data);
	//        consoleService.logStringMessage("RRR: +doStuff()")
    } catch(e) {
        consoleService.logStringMessage("Bad happened: " + e);
    }
};

function doStuff(data) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
    //consoleService.logStringMessage("content.contentDocument: " + content.contentDocument);
    //    consoleService.logStringMessage("RRR: content.document: " + content.document);
    //    consoleService.logStringMessage("RRR: content.document.contentType: " + content.document.contentType);
    // Send all data back, along with the result
    data.hasImage = content.document.contentType.indexOf("image/") >= 0;
    if (data.location == "about:blank") {
       // Keep waiting
    data.location = content.document.location.toString();
    consoleService.logStringMessage("RRR: doc FS got location: " + data.location.substr(0, 40) + ", hasImage:" + data.hasImage);
    //consoleService.logStringMessage("RRR: hasImage: " + data.hasImage);
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
