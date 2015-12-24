/*
** asyncTabCollector.js -- singleton object owned by selectTabDialog.js that gets tabs via frameScript messages
*/

var tabCollector = {monkey:"cow"};
(function() {

 this.collectTabs = function() {
      this.dump("**************** HEYYYA we're collecting");
 };
     
 this.dump = function(aMessage) {
   var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
   .getService(Components.interfaces.nsIConsoleService);
   consoleService.logStringMessage("TH/ATC: " + aMessage);
 };

}).apply(tabCollector);
