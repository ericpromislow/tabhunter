Cu = Components.utils;

function tabhunter_global_load(event) {
   Cu.import("chrome://tabhunter/chrome/content/tabhunter.jsm");
   ep_extensions.tabhunter.onload(event);
}

function tabhunter_global_unload(event) {
   ep_extensions.tabhunter.onunload(event);
}
