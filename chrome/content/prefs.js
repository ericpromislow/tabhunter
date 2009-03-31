// Copyright (C) Eric Promislow 2008 - 2009.  All Rights Reserved.
// See full license in tabhunter.js

var ThPrefs = {};

// module-global data

(function() {

// Initializers

const prefNames = ['closeOnReturn','showStatusBarIcon', 'showMenuItem'];

this.onLoad = function() {
    try {
        var parentWindow = opener;
        if (parentWindow.document.documentElement.getAttribute('windowtype')
            == "Extension:Manager") {
            parentWindow = parentWindow.opener;
        }
    this.mainHunter = parentWindow.ep_extensions.tabhunter;
    this.prefs = (Components.classes['@mozilla.org/preferences-service;1']
                  .getService(Components.interfaces.nsIPrefService)
                  .getBranch('extensions.tabhunter.'));
    if (this.mainHunter.isLinux()) {
        var x = screenX;
        var y = screenY;
        if (this.prefs.prefHasUserValue('screenX')) {
            x = this.prefs.getIntPref('screenX');
        }
        if (this.prefs.prefHasUserValue('screenY')) {
            y = this.prefs.getIntPref('screenY');
        }
        setTimeout(function() {
                window.moveTo(x, y);
            }, 0);
    }
    this.initKeyConfigPopup();
    if (!this.prefs.prefHasUserValue('closeOnReturn')) {
        this.prefs.setBoolPref('closeOnReturn', true);
    }
    if (!this.prefs.prefHasUserValue('showStatusBarIcon')) {
        this.prefs.setBoolPref('showStatusBarIcon', true);
    }
    if (!this.prefs.prefHasUserValue('showMenuItem')) {
        this.prefs.setBoolPref('showMenuItem', true);
    }
    this.dialog = {};
    this.dialog.showStatusBarIcon = document.getElementById("th-showStatusBarIcon");
    this.dialog.showMenuItem = document.getElementById("th-showMenuItem");
    this.dialog.closeOnReturn = document.getElementById("th-closeOnReturn");
    this._updateDialogFromPrefs();
    } catch(ex) { alert(ex); }
};

this.onUnload = function() {
    if (this.mainHunter.isLinux()) {
        this.prefs.setIntPref('screenX', screenX);
        this.prefs.setIntPref('screenY', screenY);
    }
};

this.onSubmit = function() {
    try {
    this._updatePrefsFromDialog();
    this._updateUIFromDialog();
    } catch(ex) {
        alert("onSubmit: "  + ex)
    }
};

this.onCancel = function() {
};

this._updatePrefsFromDialog = function(prefs) {
    for (var name, i = 0; name = prefNames[i]; ++i) {
         this.prefs.setBoolPref(name, this.dialog[name].checked);
    }
};

this._updateDialogFromPrefs = function(prefs) {
    for (var name, i = 0; name = prefNames[i]; ++i) {
        this.dialog[name].checked = this.prefs.getBoolPref(name);
    }
};

this._updateUIFromDialog = function() {
    var wmService = (Components.classes["@mozilla.org/appshell/window-mediator;1"].
                      getService(Components.interfaces.nsIWindowMediator));
    var openWindows = wmService.getEnumerator("navigator:browser");
    var openWindow;
    while (!!(openWindow = openWindows.getNext())) {
        var doc = openWindow.document;
        doc.getElementById("th-status-image").collapsed = !this.dialog.showStatusBarIcon.checked;
        doc.getElementById("menuitem_EPExt_TabhunterLaunch").hidden = !this.dialog.showMenuItem.checked;
    }
}
// Methods for managing the launch key

this.initKeyConfigPopup = function() {
    this.kbLaunchNames = {
        factoryKey: 'kb-launch-factory-key',
        factoryModifiers: 'kb-launch-factory-modifiers',
        factoryIsKeyCode: 'kb-launch-factory-isKeyCode',
        userKey: 'kb-launch-user-key',
        userModifiers: 'kb-launch-user-modifiers',
        userIsKeyCode: 'kb-launch-user-isKeyCode'
    };
    var launchKey, launchModifiers, launchIsKeyCode;
    if (this.prefs.prefHasUserValue(this.kbLaunchNames.userKey)) {
        launchKey = this.prefs.getCharPref(this.kbLaunchNames.userKey);
        launchIsKeyCode = this.prefs.getBoolPref(this.kbLaunchNames.userIsKeyCode);
        launchModifiers = this.prefs.getCharPref(this.kbLaunchNames.userModifiers);
    } else if (this.prefs.prefHasUserValue(this.kbLaunchNames.factoryKey)) {
        launchKey = this.prefs.getCharPref(this.kbLaunchNames.factoryKey);
        launchModifiers = this.prefs.getCharPref(this.kbLaunchNames.factoryModifiers);
        launchIsKeyCode = this.prefs.getBoolPref(this.kbLaunchNames.factoryIsKeyCode);
    } else {
        launchKey = "T";
        launchModifiers = (window.navigator.platform.search("Mac") == 0
                                 ? "meta control"
                                 : "control alt");
        launchIsKeyCode = false;
    }
    // Init the platform keys (code from twitterfox)
    
    this.localeKeys = document.getElementById("localeKeys");

    var platformKeys = document.getElementById("platformKeys");
    this.platformKeys = {};
    this.platformKeys.shift   = platformKeys.getString("VK_SHIFT");
    this.platformKeys.meta    = platformKeys.getString("VK_META");
    this.platformKeys.alt     = platformKeys.getString("VK_ALT");
    this.platformKeys.control = platformKeys.getString("VK_CONTROL");
    this.platformKeys.sep     = platformKeys.getString("MODIFIER_SEPARATOR");

    this.vkNames = {};
    for (var property in KeyEvent) {
      this.vkNames[KeyEvent[property]] = property.replace("DOM_","");
    }
    this.vkNames[8] = "VK_BACK";
    if (!launchIsKeyCode) {
        this.displayKeyConfigPopup(launchKey, "", launchModifiers);
    } else {
        this.displayKeyConfigPopup("", this.vkNames[launchKey], launchModifiers);
    }
};

this.getPrintableKeyName = function(modifiers,key,keycode) {
    if (modifiers == "shift,alt,control,accel" && keycode == "VK_SCROLL_LOCK") return "";
    
    if (!modifiers && !keycode) {
      return "";
    }
    
    var val = "";
    if (modifiers) {
        val = modifiers.replace(/^[\s,]+|[\s,]+$/g,"").split(/[\s,]+/g).join(this.platformKeys.sep);
    }
    
    var  mod = ["alt", "shift", "control", "meta"];
    for (var i in mod) {
        val = val.replace(mod[i], this.platformKeys[mod[i]]);
    }
    
    if (val) {
        val += this.platformKeys.sep;
    }
    
    if (key) {
        val += key;
    }
    if (keycode) {
      try {
        val += this.localeKeys.getString(keycode);
      }
      catch(e) {
        val += keycode;
      }
    }
    return val;
};

//XXX Handle keycodes as well.
this.displayKeyConfigPopup = function(launchKey, launchKeyCode, launchModifiers) {
    try {
    var val = this.getPrintableKeyName(launchModifiers, launchKey, launchKeyCode);
    if (val) {
      document.getElementById("th-keyConfigPopup").value = val;
    } else {
        this.tabhunterSession.dump("displayKeyConfigPopup: no val for key="
                                   + launchKey
                                   + ", mods:"
                                   + launchModifiers);
    }
    } catch(ex) {
        this.tabhunterSession.dump(ex);
    }
};

this.revertConfigKeyPress = function(event) {
    var launchKey = this.prefs.getCharPref(this.kbLaunchNames.factoryKey);
    var launchModifiers = this.prefs.getCharPref(this.kbLaunchNames.factoryModifiers);
    var launchIsKeyCode = this.prefs.getBoolPref(this.kbLaunchNames.factoryIsKeyCode);
    this.prefs.setCharPref(this.kbLaunchNames.userKey, launchKey);
    this.prefs.setCharPref(this.kbLaunchNames.userModifiers, launchModifiers);
    this.prefs.setBoolPref(this.kbLaunchNames.userIsKeyCode, launchIsKeyCode);
    if (launchIsKeyCode) {
        this.displayKeyConfigPopup("", launchKey, launchModifiers);
    } else {
        this.displayKeyConfigPopup(launchKey, "", launchModifiers);
    }
};

this.handleConfigKeyPress = function(event) {
    // code taken from twitterfox (not under any license)
    event.preventDefault();
    event.stopPropagation();

    var modifiers = [];
    if(event.altKey)   modifiers.push("alt");
    if(event.ctrlKey)  modifiers.push("control");
    if(event.metaKey)  modifiers.push("meta");
    if(event.shiftKey) modifiers.push("shift");

    modifiers = modifiers.join(" ");

    var key = "";
    var keycode = "";
    var prefKey = "";
    if (event.charCode) {
        prefKey = key = String.fromCharCode(event.charCode).toUpperCase();
    } else {
        keycode = this.vkNames[prefKey = event.keyCode];
        if (!keycode) {
            this.tabhunterSession.dump("handleConfigKeyPress: no vk-name for keyCode: " + event.keyCode);
            return;
        }
    }
    this.prefs.setCharPref(this.kbLaunchNames.userKey, prefKey);
    this.prefs.setCharPref(this.kbLaunchNames.userModifiers, modifiers);
    this.prefs.setBoolPref(this.kbLaunchNames.userIsKeyCode, !event.charCode);
    this.displayKeyConfigPopup(key, keycode, modifiers);
    
};

}).apply(ThPrefs);
