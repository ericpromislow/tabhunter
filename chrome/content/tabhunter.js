Cu = Components.utils;

alert("loading tabhunter.js....");

function tabhunter_global_load(event) {
   try {
   alert("- imported th.jsm");
   Cu.import("chrome://tabhunter/chrome/content/tabhunter.jsm");
   alert("+ imported th.jsm");
   ep_extensions.tabhunter.onload(event);
   alert("+ did th.onload");
   window.removeEventListener("load", tabhunter_global_load, false);
   window.addEventListener("unload", tabhunter_global_unload, false);
   } catch(ex) {
      alert("failed to load tabhunter: " + ex);
   }
}

function tabhunter_global_unload(event) {
   alert("**** >> tabhunter_global_unload");
   // ep_extensions.tabhunter.onunload(event);
}

window.addEventListener("load", tabhunter_global_load, false);

alert("done loading tabhunter.js");
