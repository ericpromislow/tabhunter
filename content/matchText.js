// -*- Mode: javascript; indent-tabs-mode: nil; js-indent-level: 4 -*- 

browser.runtime.onMessage.addListener(matchText);

function matchText(message, sender, sendResponse) {
    var textContent = document.innerHTML;
    var result = [matchPlainText, matchRegex, matchXPath].
            some((fn) => fn(pattern, textContent));
    sendResponse({result: result});
}

function matchPlainText(pattern, textContent) {
    return textContent.indexOf(pattern) >= 0;
}

function matchRegex(pattern, textContent) {
    if (!/[\*\?\[\(\{\\]/.test(pattern)) {
        return false;
    }
    try {
        let p = new RegExp(pattern);
        return p.test(textContent);
    } catch(ex) {}
    return false;
}

function matchXPath(pattern) {
    if (pattern.indexOf("/") == -1) {
        // Not quite right, but don't bother setting up an xpath evaluation if
        // there's no path.
        return false;
    }
    try {
        return matchXPathAux(pattern);
    } catch(ex) {
        console.log(`tabhunter: xpath search (#1): ${msg}`);
        return false;
    }
}

function matchXPathAux(pattern) {
    var contextNode = document.documentElement;
    var namespaceResolver =
        document.createNSResolver(contextNode.ownerDocument == null
                                  ? contextNode.documentElement
                                  : contextNode.ownerDocument.documentElement);
    var resultType = XPathResult.ANY_TYPE;
    var nodeSet = null;
    try {
        nodeSet = document.evaluate(xpathExpression, contextNode, namespaceResolver,
                                    resultType, null);
        switch (nodeSet.resultType) {
        case XPathResult.NUMBER_TYPE:
            return nodeSet.numberValue();
        case XPathResult.STRING_TYPE:
            return nodeSet.stringValue();
        case XPathResult.BOOLEAN_TYPE:
            return nodeSet.booleanValue();
        case XPathResult.FIRST_ORDERED_NODE_TYPE:
        case XPathResult.ORDERED_NODE_ITERATOR_TYPE:
        case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
            return !!nodeSet.iterateNext();
        case XPathResult.ORDERED_NODE_SNAPSHOT_TYPE:
        case XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE:
            return (nodeSet.snapshotLength > 0 && !!nodeSet.snapshotItem(0));
        default:
            throw new Error(`Unexpected xcode result type: ${nodeSet.resultType}`);
        }
    } catch(ex) {
        var msg = ex.message;
        if (ex.inner) msg += "; " + ex.inner;
        if (ex.data) msg += "; " + ex.data;
        console.log(`tabhunter: xpath search: ${msg}`);
    }
    return false;
}
