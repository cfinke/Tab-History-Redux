Components.utils.import("resource://gre/modules/Services.jsm");

let unloaders = [];

function addHooks(win) {
	TAB_HISTORY_REDUX.load(win);
	
	win.addEventListener("unload", function () {
		win.removeEventListener("unload", arguments.callee, false);
		
		removeHooks(win);
	}, false);
}

function removeHooks(win) {
	TAB_HISTORY_REDUX.unload(win);
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

var TAB_HISTORY_REDUX = {
	load : function (win) {
		win.tabHistorySelectionHistory = [null, null];
		
		win.gBrowser.tabContainer.addEventListener("TabSelect", TAB_HISTORY_REDUX.tabSelect, false);
		win.gBrowser.tabContainer.addEventListener("TabOpen", TAB_HISTORY_REDUX.tabOpen, false);
	},
	
	unload : function (win) {
		delete win.tabHistorySelectionHistory;
		
		win.gBrowser.tabContainer.removeEventListener("TabSelect", TAB_HISTORY_REDUX.tabSelect, false);
		win.gBrowser.tabContainer.removeEventListener("TabOpen", TAB_HISTORY_REDUX.tabOpen, false);
	},
	
	tabOpen : function (evt) {
		var tab = evt.target;
		var win = tab.ownerDocument.defaultView;
		
		if (tab.getAttribute("label") == win.gBrowser.mStringBundle.getString("tabs.emptyTabTitle")) {
			// The only way to tell if it's a blank tab.
			// Nothing should be copied for tabs that were opened and intended to be blank.
		}
		else {
			if (!tab.selected) {
				// The new tab was opened in the background, meaning the current tab is definitely the parent.
				// Unless the new tab comes from clicking on a bookmark and having bookmarks open in the background...
				TAB_HISTORY_REDUX.copyHistory(win, win.gBrowser.selectedTab, tab);
			}
			else {
				if (tab == win.tabHistorySelectionHistory[0]) {
					// The tab is already selected.
					TAB_HISTORY_REDUX.copyHistory(win.tabHistorySelectionHistory[1], tab);
				}
				else if (win.tabHistorySelectionHistory[0]) {
					TAB_HISTORY_REDUX.copyHistory(win.tabHistorySelectionHistory[0], tab);
				}
			}
		}
	},
	
	tabSelect : function (event) {
		var tab = event.target;
		
		var win = tab.ownerDocument.defaultView;
		
		win.tabHistorySelectionHistory[1] = win.tabHistorySelectionHistory[0];
		win.tabHistorySelectionHistory[0] = tab;
	},
	
	copyHistory : function (win, parentTab, childTab) {
		var parentHistory = win.gBrowser.getBrowserForTab(parentTab).sessionHistory;
		var childHistory = win.gBrowser.getBrowserForTab(childTab).sessionHistory;
		
		// This line enables .addEntry
		childHistory.QueryInterface(Components.interfaces.nsISHistoryInternal);
	
		for (var i = 0, _len = parentHistory.index + 1; i < _len; i++) {
			if (parentHistory.getEntryAtIndex(i, false).URI.scheme != 'about') {
				childHistory.addEntry(parentHistory.getEntryAtIndex(i, false), true);
			}
		}
	},
	
	log : function (m) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("TAB HISTORY: " + m);
	}
};