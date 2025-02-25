let openTabs = 0;
let tabDomains = {};
let domainCounts = {};

function getDomain(url) {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    return null;
  }
  try {
    const hostname = new URL(url).hostname;
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch (e) {
    return null;
  }
}

function updateBadge() {
  chrome.action.setBadgeText({ text: openTabs > 0 ? openTabs.toString() : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#FF0000" }); // Brighter red
  chrome.action.setBadgeTextColor({ color: "#FFFFFF" }); // White text
}

function initializeState() {
  chrome.tabs.query({}, (tabs) => {
    openTabs = tabs.length;
    tabDomains = {};
    domainCounts = {};
    for (const tab of tabs) {
      const domain = getDomain(tab.url);
      if (domain) {
        tabDomains[tab.id] = domain;
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      }
    }
    chrome.storage.local.get(['maxConcurrentTabs'], (data) => {
      const maxConcurrent = data.maxConcurrentTabs || 0;
      if (openTabs > maxConcurrent) {
        chrome.storage.local.set({ maxConcurrentTabs: openTabs });
      }
    });
    updateBadge();
  });
}

initializeState();

chrome.tabs.onCreated.addListener((tab) => {
  openTabs++;
  const domain = getDomain(tab.url);
  if (domain) {
    tabDomains[tab.id] = domain;
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  }
  chrome.storage.local.get(['allTimeTabs'], (data) => {
    const allTime = (data.allTimeTabs || 0) + 1;
    chrome.storage.local.set({ allTimeTabs: allTime });
  });
  chrome.storage.local.get(['maxConcurrentTabs'], (data) => {
    const maxConcurrent = data.maxConcurrentTabs || 0;
    if (openTabs > maxConcurrent) {
      chrome.storage.local.set({ maxConcurrentTabs: openTabs });
    }
  });
  updateBadge();
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  openTabs--;
  if (tabDomains[tabId]) {
    const domain = tabDomains[tabId];
    domainCounts[domain]--;
    if (domainCounts[domain] === 0) {
      delete domainCounts[domain];
    }
    delete tabDomains[tabId];
  }
  updateBadge();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const oldDomain = tabDomains[tabId];
    const newDomain = getDomain(changeInfo.url);
    if (oldDomain) {
      domainCounts[oldDomain]--;
      if (domainCounts[oldDomain] === 0) {
        delete domainCounts[oldDomain];
      }
    }
    if (newDomain) {
      domainCounts[newDomain] = (domainCounts[newDomain] || 0) + 1;
    }
    tabDomains[tabId] = newDomain;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getData') {
    chrome.tabs.query({}, (tabs) => {
      const domainCounts = {};
      const domainFavicons = {};
      tabs.forEach(tab => {
        const domain = getDomain(tab.url);
        if (domain) {
          domainCounts[domain] = (domainCounts[domain] || 0) + 1;
          // Store the favicon URL if available and not already set
          // This prioritizes the first tab's favicon; could be enhanced to check resolution
          if (tab.favIconUrl && !domainFavicons[domain]) {
            domainFavicons[domain] = tab.favIconUrl;
          }
        }
      });
      Promise.all([
        chrome.windows.getAll().then(windows => windows.length),
        Promise.resolve(tabs.length),
        chrome.windows.getCurrent().then(window => chrome.tabs.query({ windowId: window.id }).then(tabs => tabs.length)),
        chrome.windows.getCurrent().then(window => chrome.tabs.query({ windowId: window.id, pinned: true }).then(tabs => tabs.length)),
        chrome.storage.local.get(['allTimeTabs', 'maxConcurrentTabs']),
        Promise.resolve({ domainCounts, domainFavicons })
      ]).then(([openWindows, openTabs, currentWindowTabs, currentWindowPinnedTabs, storageData, domainData]) => {
        sendResponse({
          openWindows,
          openTabs,
          currentWindowTabs,
          currentWindowPinnedTabs,
          allTimeTabs: storageData.allTimeTabs || 0,
          maxConcurrentTabs: storageData.maxConcurrentTabs || 0,
          domainCounts: domainData.domainCounts,
          domainFavicons: domainData.domainFavicons
        });
      });
    });
    return true;
  } else if (request.type === 'resetAllTimeTabs') {
    chrome.storage.local.set({ allTimeTabs: 0 });
  } else if (request.type === 'resetMaxConcurrentTabs') {
    chrome.storage.local.set({ maxConcurrentTabs: openTabs });
  } else if (request.type === 'getTabsForDomain') {
    chrome.tabs.query({}, (tabs) => {
      const domainTabs = tabs.filter((tab) => {
        const domain = getDomain(tab.url);
        return domain === request.domain;
      })
        .map((tab) => ({ id: tab.id, title: tab.title, url: tab.url, windowId: tab.windowId, lastAccessed: tab.lastAccessed }));
      sendResponse({ tabs: domainTabs });
    });
    return true;
  }
});