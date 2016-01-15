// Frame script for seeing if a document has an image

var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);

var handleMessage = function(msgData) {
    try {
        doStuff(msgData.data);
    } catch(e) {
        consoleService.logStringMessage("Bad happened: " + e);
    }
};

function doStuff(data) {
    // Send all data back, along with the result
    data.hasImage = content.document.contentType.indexOf("image/") >= 0;
    data.location = content.document.location.toString();
    if (false) {
    consoleService.logStringMessage("RRR: doc FS: windowIdx:" + data.windowIdx +
				    ", tabIdx:" + data.tabIdx + ": got location: " + data.location.substr(0, 40));
    }
    sendAsyncMessage("tabhunter@ericpromislow.com:docType-has-image-continuation", data);
}

var handleStopListeningMessage = function(msgData) {
  //consoleService.logStringMessage("RRR: Stop listening for docType-has-image and stop-listening");
  removeMessageListener("tabhunter@ericpromislow.com:docType-has-image", handleMessage);
  removeEventListener("DOMContentLoaded", handleDOMContentLoaded, false);
  removeEventListener("mozbrowsericonchange", handleMozBrowserIconChange, false);
};

var handleDOMContentLoaded = function(event) {
  sendAsyncMessage("tabhunter@ericpromislow.com:DOMContentLoaded");
};

var handleMozBrowserIconChange = function(event) {
  var details = event.details;
    if (false) {
       consoleService.logStringMessage("RRR: favicon changed: href: " + details.href + ", sizes: " + details.sizes + ", rel: " + details.rel);
    }
  sendAsyncMessage("tabhunter@ericpromislow.com:DOMContentLoaded");
}

addMessageListener("tabhunter@ericpromislow.com:docType-has-image", handleMessage);
addMessageListener("tabhunter@ericpromislow.com:docType-has-image-shutdown", handleStopListeningMessage);

addEventListener("DOMContentLoaded", handleDOMContentLoaded, false);
addEventListener("mozbrowsericonchange", handleMozBrowserIconChange, false);
