Cu = Components.utils;

alert("loading tabhunter.js....");

function tabhunter_global_load(event) {
   try {
   alert("- imported th.jsm");
   Cu.import("chrome://tabhunter/chrome/content/tabhunter.jsm");
   alert("+ imported th.jsm");
   ep_extensions.tabhunter.onload(event);
   alert("+ did th.onload");
   } catch(ex) {
      alert("failed to load tabhunter: " + ex);
   }
}

function tabhunter_global_unload(event) {
   ep_extensions.tabhunter.onunload(event);
}

alert("done loading tabhunter.js");
