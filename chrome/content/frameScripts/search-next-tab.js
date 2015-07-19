// Frame script for searching a tab's contents

var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
//consoleService.logStringMessage("-Loading search-next-tab.js...");

var handleMessage = function(msgData) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage("got the search-next-tab message...");
    try {
        consoleService.logStringMessage("-doStuff(msgData.data: " + Object.keys(msgData.data).join(" ") + ")");
        doStuff(msgData.data);
        consoleService.logStringMessage("+doStuff()")
    } catch(e) {
        consoleService.logStringMessage("Bad happened: " + e);
    }
};

// 
function doStuff(data) {
    try {
        doStuff_aux(data);
    } catch(e) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
        consoleService.logStringMessage("Bad happened in doStuff: " + e);
    }
}

function doStuff_aux(data) {
    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    .getService(Components.interfaces.nsIConsoleService);
    var view = content; // For compatibility with the single-process form
    if (!view) {
        consoleService.logStringMessage("search-next-tab.js: -search-continuation-error");
        sendAsyncMessage("search-continuation-error", {msg: "searchNextTab: no view"});
        return;
    }
    var doc = view.document;
    var title = doc.title;
    var url = doc.location;
    consoleService.logStringMessage("search-next-tab.js: doc.location: " + url);
    var failedTest = false;
    var currentTabRE = data.currentTabRE; // Does this cross the process boundary ok?
    if (currentTabRE) {
        if (!currentTabRE.test(title) && !currentTabRE.test(url)) {
            failedTest = true;
            consoleService.logStringMessage("search-next-tab.js: -search-continuation-error(2)");
            sendAsyncMessage("search-continuation-error", {msg: ("No match on title:" + title + ", url:" + url),
                                                           "continue": true});
            return;
        }
    }
    if (!failedTest) {
        var res, posn, matchedText = null,
            pattern = data.pattern,
            searchText = doc.documentElement.innerHTML,
            searchType = data.searchType,
            regex = data.regex,
            ignoreCase = data.ignoreCase,
            __zub;
        if (!searchText) {
            // do nothing
        } else if (searchType == "searchXPath") {
            var contextNode = doc.documentElement;
            var namespaceResolver =
                document.createNSResolver(contextNode.ownerDocument == null
                                          ? contextNode.documentElement
                                          : contextNode.ownerDocument.documentElement);
            var resultType = XPathResult.ANY_UNORDERED_NODE_TYPE;
            var nodeSet = null;
            try {
                nodeSet = doc.evaluate(pattern, contextNode,
                                       namespaceResolver, resultType, null);
            } catch(ex) {
                var msg = ex.message;
                if (ex.inner) msg += "; " + ex.inner;
                if (ex.data) msg += "; " + ex.data;
                consoleService.logStringMessage("search-next-tab.js: -search-continuation-exception");
                sendAsyncMessage("search-continuation-exception", {msg: msg});
                return;
            }
            var snv = nodeSet.singleNodeValue;
            if (snv) {
                matchedText = snv.innerHTML;
                if (matchedText) {
                    matchedText = matchedText.replace(/^[\s\r\n]+/, '');
                    if (matchedText.length > 40) {
                        matchedText = matchedText.substring(0, 40) + "...";
                    } else if (matchedText.length == 0) {
                        matchedText = "<white space only>";
                    }
                }
            }
        } else if (this.searchType == "searchRegEx") {
            res = regex.exec(searchText);
            if (res) {
                matchedText = RegExp.lastMatch;
            }
        } else {
            var searchTextFinal = ignoreCase ? searchText.toLowerCase() : searchText;
            posn = searchTextFinal.indexOf(this.patternFinal);
            if (posn >= 0) {
                matchedText = searchText.substring(posn, pattern.length);
            }
        }
        if (matchedText) {
            consoleService.logStringMessage("search-next-tab.js: -search-continuation-match: "
                                            + "posn: " + posn
                                            + ", url: " + url
                                            + ", title: " + title
                                            + ", matchedText: " + (matchedText.length < 40 ? matchedText : (matchedText.length + " chars")));
            sendAsyncMessage("search-continuation-match", {posn:posn, url:url, title:title, matchedText:matchedText});
        } else {
            consoleService.logStringMessage("search-next-tab.js: -search-continuation-no-match#1");
            sendAsyncMessage("search-continuation-no-match");
        }
    } else {
        consoleService.logStringMessage("search-next-tab.js: -search-continuation-no-match#2");
        sendAsyncMessage("search-continuation-no-match");
    }
}

addMessageListener("tabhunter@ericpromislow.com:search-next-tab", handleMessage);
// No need to remove the message-listener when the tab is removed as we won't be
// getting any messages on it.


//consoleService.logStringMessage("+ Loaded search-next-tab.js.");
