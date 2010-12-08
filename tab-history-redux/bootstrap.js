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
	TabHistory.log("in startup");
	
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
	
	TabHistory.log("out of startup");
}

function shutdown() {
	TabHistory.log("in shutdown");
	
	unloaders.forEach(function (unload) { unload(); });
	
	let browserWindows = Services.wm.getEnumerator("navigator:browser");
	
	while (browserWindows.hasMoreElements()) {
		removeHooks(browserWindows.getNext());
	}
	
	TabHistory.log("out of shutdown");
}

var TabHistory = {
	load : function (win) {
		TabHistory.log("in load");
		
		win.tabHistorySelectionHistory = [null, null];
		
		win.gBrowser.tabContainer.addEventListener("TabSelect", TabHistory.tabSelect, false);
		win.gBrowser.tabContainer.addEventListener("TabOpen", TabHistory.tabOpen, false);
		
		TabHistory.log("out of load");
	},
	
	unload : function (win) {
		TabHistory.log("in unload");
		
		delete win.tabHistorySelectionHistory;
		
		win.gBrowser.tabContainer.removeEventListener("TabSelect", TabHistory.tabSelect, false);
		win.gBrowser.tabContainer.removeEventListener("TabOpen", TabHistory.tabOpen, true);
		
		TabHistory.log("out of unload");		
	},
	
	tabOpen : function (evt) {
		TabHistory.log("in tabOpen");
		
		var tab = evt.target;
		var win = tab.ownerDocument.defaultView;
		
		if (tab.getAttribute("label") == win.gBrowser.mStringBundle.getString("tabs.emptyTabTitle")) {
			// The only way to tell if it's a blank tab.
			// Nothing should be copied for tabs that were opened and intended to be blank.
		}
		else {
			if (!tab.selected) {
				TabHistory.log("Background tab");
			
				// The new tab was opened in the background, meaning the current tab is definitely the parent.
				// Unless the new tab comes from clicking on a bookmark and having bookmarks open in the background...
				TabHistory.copyHistory(win, win.gBrowser.selectedTab, tab);
			}
			else {
				TabHistory.log("Foreground tab");
			
				if (tab == win.tabHistorySelectionHistory[0]) {
					TabHistory.log("Already selected");
				
					TabHistory.copyHistory(win.tabHistorySelectionHistory[1], tab);
				}
				else if (win.tabHistorySelectionHistory[0]) {
					TabHistory.log("Not yet selected");
				
					TabHistory.copyHistory(win.tabHistorySelectionHistory[0], tab);
				}
			}
		}
		
		TabHistory.log("out of tabOpen");
	},
	
	tabSelect : function (event) {
		TabHistory.log("in tabSelect");
		
		var tab = event.target;
		
		var win = tab.ownerDocument.defaultView;
		
		win.tabHistorySelectionHistory[1] = win.tabHistorySelectionHistory[0];
		win.tabHistorySelectionHistory[0] = tab;
		
		TabHistory.log("out of tabSelect");
	},
	
	copyHistory : function (win, parentTab, childTab) {
		TabHistory.log("in copyHistory");
		
		var parentHistory = win.gBrowser.getBrowserForTab(parentTab).sessionHistory;
		var childHistory = win.gBrowser.getBrowserForTab(childTab).sessionHistory;
		
		// This line enables .addEntry
		childHistory.QueryInterface(Components.interfaces.nsISHistoryInternal);
	
		for (var i = 0, _len = parentHistory.index + 1; i < _len; i++) {
			if (parentHistory.getEntryAtIndex(i, false).URI.scheme != 'about') {
				childHistory.addEntry(parentHistory.getEntryAtIndex(i, false), true);
			}
		}
		
		TabHistory.log("out of copyHistory");
	},
	
	log : function (m) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("TAB HISTORY: " + m);
	}
};