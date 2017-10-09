// tabhunter.js -- See LICENSE.txt for copyright and license details.

var items = [];
var selectedIndex;    // visible
var lastClickedIndex; // visible
var matchedItems;
var tablist;
var mainPattern;
var mainPatternJS;
var textarea;
var showElapsedTimes = false; // Need a way to enable this.
var t1, t2;
var closeTabsButton;
var matchCloseTabs;

// select/option items take only text.
// lists take an image as well, so let's try it.
function init() {

    var list = document.getElementById("list");
    mainPattern = document.getElementById("pattern");
    mainPatternJS = $("#pattern");
    textarea = document.getElementById("textarea");

    tablist = list;

    mainPattern.addEventListener("input", onPatternChanged, false);
    document.addEventListener("keydown", processArrowKey, false);
    document.getElementById("go").addEventListener("mouseup", doGoButton, false);
    document.getElementById("done").addEventListener("mouseup", doDoneButton, false);
    closeTabsButton = document.getElementById("closeTabs");
    closeTabsButton.addEventListener("mouseup", doCloseTabsButton, false);
    document.getElementById("copyURL").addEventListener("mouseup", doCopyURLButton, false);
    document.getElementById("copyTitle").addEventListener("mouseup", doCopyTitleButton, false);
    document.getElementById("copyURLTitle").addEventListener("mouseup", doCopyURLTitleButton, false);

    matchCloseTabs = /^(.*?)(s?)$/;

    $("button").mouseover(doMouseOver);
    $("button").mouseout(doMouseOut);
    $("button").mousedown(doMouseDown);
    $("button").mouseup(doMouseUp);

    var gotPatternOK = function(item) {
        if ('pattern' in item) {
            mainPattern.value = item.pattern;
        }
        populateTabList();
    };
    var gotPatternErr = function(err) {
        populateTabList();
    };

    browser.storage.local.get("pattern").then(gotPatternOK, gotPatternErr);
}

function populateTabList() {
    selectedIndex = 0;
    lastClickedIndex = -1;
    matchedItems = [];
    const getAllProperties = {populate: true, windowTypes: ['normal']}
    const endTime = function(cmd) {
        t2 = (new Date()).valueOf();
        console.log("Elapsed time to " + cmd + ": " + ((t2 - t1)/1000) + " msec");
    }
    const errGetAllWindows = function(err) {
        if (showElapsedTimes) {
            endTime("getting windows");
        }
        console.log(err);
    }
    const compareByName = function(tab1, tab2) {
        let title1 = tab1[0].toLowerCase();
        let title2 = tab2[0].toLowerCase();
        let url1 = tab1[1].toLowerCase();
        let url2 = tab2[1].toLowerCase();
        return (title1 < title2 ? -1 :
                (title1 > title2 ? 1 :
                 (url1 < url2 ? -1 :
                  (url1 > url2 ? 1 : 0))));
    };
    
    const doGetAllWindows = function (windowInfoArray) {
        if (showElapsedTimes) {
            endTime("getting " + (windowInfoArray.length) + " windows");
            t1 = (new Date()).valueOf();
        }
        items.splice(0); // clear
        //TODO: Use a heap array to make building a sorted list one item at a time
        // an n . lg(n) operation
        for (var windowInfo of windowInfoArray) {
            var id = windowInfo.id;
            var tabs = windowInfo.tabs;
            for (var tab of tabs) {
                // Tabs: save [title, url, window#id, tab#id, tab#index, tab#favIconUrl
                items.push([tab.title, tab.url, id, tab.id, tab.index, tab.favIconUrl]);
            }
        }
        if (showElapsedTimes) {
            endTime("getting tabs");
            t1 = (new Date()).valueOf();
        }
        items.sort(compareByName);
        
        if (showElapsedTimes) {
            endTime("sorting tabs");
            t1 = (new Date()).valueOf();
        }
        onPatternChanged();
        
        if (showElapsedTimes) {
            endTime("setting matched tabs");
        }
        if (matchedItems.length > 0) {
            // Need to do this in a setTimeout of 100 msec for reasons unknown
            setTimeout(function() {
                try {
                    mainPattern.focus();
                    mainPattern.select();
                } catch(e) {
                    console.log("* mainPatternJS.focus(): " + e);
                }
            }, 100);
        }
    };
    t1 = (new Date()).valueOf();
    // Load all the tabs each time we show the popup.
    //TODO: Maintain the tab list in the background processor, so we can show
    // them faster here.

    browser.windows.getAll(getAllProperties).then(doGetAllWindows, errGetAllWindows);
}

function doMouseOver(eventData) {
    if (!eventData.currentTarget.disabled) {
        $(this).addClass("highlighted");
    }
}

function doMouseOut(eventData) {
    $(this).removeClass("highlighted");
    $(this).removeClass("pressed");
}

function doMouseDown(eventData) {
    if (!eventData.currentTarget.disabled) {
        $(this).addClass("pressed");
    }
}

function doMouseUp(eventData) {
    $(this).removeClass("pressed");
}

function doVisitSelectedURL() {
    if (selectedIndex < 0 || selectedIndex >= matchedItems.length) {
        return;
    }
    var target = items[matchedItems[selectedIndex]];
    // target: tab.title, tab.url, window.id, tab.id, tab.index
    var windowId = target[2];
    var tabId = target[3];

    const getCurrentErr = function(err) {
        console.log("Error getting current window: " + err);
    };
    const getCurrentCont = function(windowInfo) {
        if (windowInfo.id != windowId) {
            const showWindowErr = function(err) {
                console.log("Error showing current window: " + err);
            };
            const showWindowCont = function(windowInfo) {
                console.log("Should be showing window: " + windowInfo.title);
            }
            const updateInfo = { focused: true, drawAttention: true, state: "normal" };
            browser.windows.update(target[2], updateInfo).then(showWindowCont, showWindowErr);
        }
    };

    const showTabErr = function(err) {
        console.log("Error showing tab id " + tabId + ": " + err);
    };
    const showTabCont = function(tab) {
        browser.windows.getCurrent().then(getCurrentCont, getCurrentErr);
    };
    const showTab = function() {
        var updateProperties = {active: true} ; // firefox doesn't do:, selected: true}
        browser.tabs.update(tabId, updateProperties).then(showTabCont, showTabErr);
    };
    showTab();
}

function processArrowKey(event) {
    try {
        processArrowKey_aux(event);
    } catch(e) {
        console.log("*** processArrowKey: awp: " + e);
    }
}

const SHIFT_KEY = 1;
const CTRL_KEY = 2;
const ALT_KEY = 4;

function processArrowKey_aux(event) {
    var mask = getModifierMask(event);

    var selectedItems = getSelectedItemsJQ();
    var keyName = event.key;
    if (keyName == "Enter") {
        if (mask != 0) {
            console.log("Enter can't be modified with shift, etc.");
        } else {
            if (selectedItems.length > 1) {
                // Keep existing behavior
                selectedIndex = selectedItems[0].actualIndex;
            } 
            doVisitSelectedURL();
        }
        event.stopPropagation();
        event.preventDefault();
        return;
    }
    var newSelectedIndex;
    if (keyName == "ArrowUp") {
        if (selectedIndex <= 0) {
            return;
        }
        newSelectedIndex = selectedIndex - 1;
    } else if (keyName == "ArrowDown") {
        if (selectedIndex >= matchedItems.length - 1) {
            return;
        }
        newSelectedIndex = selectedIndex + 1;
    } else {
        return;
    }
    var li = tablist.childNodes[newSelectedIndex];
    if ((mask & SHIFT_KEY) != SHIFT_KEY) {
        $("ul li").removeClass('selected');
    }
    if (li.addClass) {
        li.classList.addClass("selected");
    } else {
        li.setAttribute("class", "selected");
    }
    selectedIndex = newSelectedIndex;
    var url = document.getElementById("url");
    url.value = items[matchedItems[selectedIndex]][1];
}

function onListItemClick(event) {
    var i = event.target.visibleIndex;
    var mask = getModifierMask(event);
    
    if (mask == SHIFT_KEY && lastClickedIndex > -1) {
        selectRange(lastClickedIndex, i);
    } else if (mask == CTRL_KEY) {
        $(this).toggleClass('selected');
    } else {
        $("ul li").removeClass('selected');
        $(this).addClass('selected');
    }
    selectedIndex = i;
    lastClickedIndex = (mask & (SHIFT_KEY|CTRL_KEY)) == 0 ? i : -1;
    document.getElementById("url").value = items[matchedItems[i]][1];
    updateButtons();
}

function selectRange(lastClickedIndex, currentIndex) {
    if (lastClickedIndex > currentIndex) {
        [lastClickedIndex, currentIndex] = [currentIndex, lastClickedIndex];
    }
    for (var i = lastClickedIndex; i <= currentIndex; i++) {
        tablist.childNodes[i].setAttribute("class", "selected");
    }
}

function onListItemDoubleClick() {
    doVisitSelectedURL();
}

function allowAll() {
    return true;
}

function onPatternChanged() {
    matchedItems = [];
    var pattern = mainPattern.value;
    var ptn;
    var fn;
    browser.storage.local.set({"pattern": pattern});
    if (pattern.length == 0) {
        fn = allowAll;
    } else {
        try {
            if (/[A-Z]/.test(pattern) && /[a-z]/.test(pattern)) {
                // If they specify both cases, don't ignore case.
                ptn = new RegExp(pattern);
            } else {
                ptn = new RegExp(pattern, "i");
            }
            fn = function matchPtn(item) {
                return ptn.test(item[0]) || ptn.test(item[1]);
            }
        } catch(ex) {
            console.log("not a valid javascript pattern: " + ex);
            // just do a case-insensitive substring search
            ptn = pattern.toLowerCase();
            fn = function matchText(item) {
                return (item[0].toLowerCase().indexOf(ptn) >= 0
                        || item[1].toLowerCase().indexOf(ptn) >= 0);
            }
        }
    }
    for (var i = 0; i < items.length; i++) {
        if (fn(items[i])) {
            matchedItems.push(i);
        }
    }
    makeListFromMatchedItems();
}

function makeListFromMatchedItems() {
    $("#list").empty();
    $("ul li").off("dblclick", onListItemDoubleClick);
    $("ul li").off("click", onListItemClick);
    var lastClickedActualIndex = matchedItems[lastClickedIndex];
    var selectedActualIndex = matchedItems[selectedIndex];
    selectedIndex = 0;
    lastClickedIndex = -1;
    for (var i = 0; i < matchedItems.length; i++) {
        var idx = matchedItems[i];
        var el = document.createElement("li");
        el.textContent = items[idx][0] + " - " + items[idx][1];
        el.visibleIndex = i;
        el.actualIndex = idx;
        if (items[idx][5]) {
            el.style.backgroundImage = "url(" + items[idx][5] + ")";
        }
        if (idx == selectedActualIndex) {
            $(el).addClass("selected");
            selectedIndex = i;
        }
        if (lastClickedIndex > -1 && idx == lastClickedActualIndex) {
            lastClickedIndex = i;
        }
        list.appendChild(el);
    }
    $("ul li:eq(" + selectedIndex + ")").select();
    $("ul li").on("click", onListItemClick);
    $("ul li").on("dblclick", onListItemDoubleClick);
    updateActivity();
    updateURL();
    updateButtons();
}

function getSelectedItemsJQ() {
    return $("ul#list li.selected").toArray();
}


function updateButtons() {
    var selectedItemLength = getSelectedItemsJQ().length;
    var matchedItemLength = matchedItems.length;
    document.getElementById("done").disabled = false;
    var otherDisabled = selectedItemLength == 0;
    document.getElementById("go").disabled = selectedItemLength != 1 || matchedItemLength == 0;
    closeTabsButton.disabled = otherDisabled;
    document.getElementById("copyURL").disabled = otherDisabled;
    document.getElementById("copyTitle").disabled = otherDisabled;
    document.getElementById("copyURLTitle").disabled = otherDisabled;
    var closeTabsContent = closeTabsButton.textContent;
    var newCloseTabsContent = "";
    var m = matchCloseTabs.exec(closeTabsContent);
    if (m[2] == 's') {
        if (selectedItemLength == 1) {
            newCloseTabsContent = m[1];
        }
    } else if (selectedItemLength > 1) {
        newCloseTabsContent = m[1] + 's';
    }
    if (newCloseTabsContent != "") {
        closeTabsButton.textContent = newCloseTabsContent;
    }
}

function updateURL() {
    var url = document.getElementById("url");
    var selectedItems = getSelectedItemsJQ();
    if (selectedItems.length >= 1) {
        var index = selectedItems[0].actualIndex;
        URL.value = items[index][1];
        return;
    }
    if (matchedItems.length == 1) {
        url.value = items[matchedItems[0]][1];
    } else {
        url.value = "";
    }
}

function updateActivity() {
    var pattern = mainPattern.value;
    var text;
    if (pattern.length == 0) {
        text = "Hunting through " + items.length + " tabs";
    } else {
        text = "Matched " + matchedItems.length + "/" + items.length + " tabs";
    }
    document.getElementById("activity").innerText = text;
}

function doDoneButton() {
    close();
}

// Tabs: save [title, url, window#id, tab#id, tab#index, tab#favIconUrl
function doCloseTabsButton() {
    var selectedItems = getSelectedItemsJQ();
    if (selectedItems.length == 0) {
        return;
    }
    var tabIds = selectedItems.map(function(selectedItem) {
        return items[selectedItem.actualIndex][3];
    });
    var removeTabError = function(err) {
        console.log("Error removing tab: " + err);
    }
    var removeTabOK = function() {
        populateTabList();
    }
    browser.tabs.remove(tabIds).then(removeTabOK, removeTabError);
}

function gatherText(fn) {
    var selectedItems = getSelectedItemsJQ();
    if (selectedItems.length == 0) {
        return;
    }
    var textPieces = selectedItems.map(function(selectedItem) {
        return fn(items[selectedItem.actualIndex]);
    });
    return textPieces.join("\n");
}

function setClipboard(text) {
    try {
        textarea.style.display = "block";
        textarea.textContent = text;
        textarea.select();
        document.execCommand("cut");
    } catch(ex) {
        console.log("Error setting/copying text: " + text);
    }
    textarea.style.display = "none";
}

function doCopyURLButton() {
    var text = gatherText(function(item) { return item[1]; });
    setClipboard(text);
}

function doCopyTitleButton() {
    var text = gatherText(function(item) { return item[0]; });
    setClipboard(text);
}

function doCopyURLTitleButton() {
    var text = gatherText(function(item) { return item[1] + '-' + item[0]; });
    setClipboard(text);
}

function doGoButton() {
    var selItems = getSelectedItemsJQ();
    var value = null;
    if (selItems.length == 1) {
        value = items[matchedItems[selectedIndex]];
    } else if (matchedItems.length == 1) {
        value = items[matchedItems[0]];
    } else {
        return;
    }
    doVisitSelectedURL();
}

function getModifierMask(event) {
    return (0 |
            (event.shiftKey ? SHIFT_KEY : 0 ) |
            (event.ctrlKey ? CTRL_KEY : 0 ) |
            (event.altKey ? ALT_KEY : 0 ) |
            (event.metaKey ?  CTRL_KEY: 0 ) |
            (event.commandKey ? CTRL_KEY : 0 ));
}

$(document).ready(init);
