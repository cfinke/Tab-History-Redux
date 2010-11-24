Components.utils.import("resource://gre/modules/Services.jsm");

let unloaders = [];

function addHooks(win) {
	TabHistory.load(win);
	
	win.addEventListener("unload", function () {
		win.removeEventListener("unload", arguments.callee, false);
		
		removeHooks(win);
	}, false);
}

function removeHooks(win) {
	TabHistory.unload(win);
}

function startup() {
	let browserWindows = Services.wm.getEnumerator("navigator:browser");
	
	while (browserWindows.hasMoreElements()) {
		addHooks(browserWindows.getNext());
	}
	
	function windowWatcher(subject, topic) {
		if (topic != 'domwindowopened') {
			return;
		}
	
		subject.addEventListener("load", function () {
			subject.removeEventListener("load", arguments.callee, false);
			
			let doc = subject.document.documentElement;
		
			if (doc.getAttribute("windowtype") == "navigator:browser") {
				addHooks(subject);
			}
		}, false);
	}
	
	Services.ww.registerNotification(windowWatcher);
	
	unloaders.push(function () { Services.ww.unregisterNotification(windowWatcher); });
}

function shutdown() {
	unloaders.forEach(function (unload) { unload(); });
	
	let browserWindows = Services.wm.getEnumerator("navigator:browser");
	
	while (browserWindows.hasMoreElements()) {
		removeHooks(browserWindows.getNext());
	}
}

var TabHistory = {
	load : function (win) {
		win.gBrowser.oldAddTab = win.gBrowser.addTab;
		
		win.gBrowser.addTab = (function (originalAddTab) {
				return function () {
					var selectedTab = win.gBrowser.selectedTab;
					var newTab = originalAddTab.apply(win.gBrowser, arguments);
					TabHistory.copyHistory(win, selectedTab, newTab);
					return newTab;
				}
			}
		)(win.gBrowser.addTab);
	},
	
	unload : function (win) {
		win.gBrowser.addTab = win.gBrowser.oldAddTab;
	},
	
	copyHistory : function(win, fromTab, newTab) {
		var fromHistory = win.getBrowser().getBrowserForTab(fromTab).sessionHistory;
		var toHistory = win.getBrowser().getBrowserForTab(newTab).sessionHistory;
		
		// needed to use addEntry
		toHistory.QueryInterface(Components.interfaces.nsISHistoryInternal);

		// copy oldHistory entries to newHistory, simulating a continued session
		for (var i = 0; i < (fromHistory.index + 1); ++i) {
			if (fromHistory.getEntryAtIndex(i, false).URI.scheme != 'about') { // don't copy "about:config"
				toHistory.addEntry(fromHistory.getEntryAtIndex(i, false), true);
			}
		}
	}
};