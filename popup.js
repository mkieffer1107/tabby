document.addEventListener('DOMContentLoaded', () => {
  // Initial UI setup
  document.getElementById('searchContainer').classList.remove('active');
  document.getElementById('searchInput').value = '';
  document.getElementById('searchTrigger').style.display = 'flex';
  document.body.classList.remove('search-mode');
  document.body.classList.remove('search-active');
  
  // Add event listener to the cat emoji
  const catEmoji = document.querySelector('h1 .emoji');
  catEmoji.style.cursor = 'pointer';
  
  // Create audio lazily - don't initialize until needed
  let meowSound = null;
  
  // Play sound when emoji is clicked
  catEmoji.addEventListener('click', () => {
    // Lazy load audio on first click
    if (!meowSound) {
      meowSound = new Audio('assets/infinifi-meow.mp3');
    }
    
    // Change emoji to 😸
    catEmoji.textContent = '😸';
    
    // Start playing immediately - no delay
    meowSound.currentTime = 0;
    const playPromise = meowSound.play();
    
    // Animation should happen simultaneously with audio
    catEmoji.classList.add('meow');
    setTimeout(() => {
      catEmoji.classList.remove('meow');
      // Revert emoji back to 😺
      catEmoji.textContent = '😺';
    }, 600); // Match animation duration in CSS
    
    // Handle potential autoplay restrictions
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log("Audio play was prevented:", error);
      });
    }
  });
});

function closeSearch() {
  const searchContainer = document.getElementById('searchContainer');
  const searchTrigger = document.getElementById('searchTrigger');
  const searchInput = document.getElementById('searchInput');
  
  searchInput.value = '';
  searchContainer.classList.remove('active');
  searchTrigger.style.display = 'flex';
  
  document.getElementById('searchView').classList.remove('active');
  document.getElementById('tabView').classList.remove('active');
  document.getElementById('domainView').classList.add('active');
  document.body.classList.remove('search-active');
  document.body.classList.remove('search-mode');
  const viewTitle = document.getElementById('viewTitle');
  viewTitle.classList.remove('search-results');
  viewTitle.textContent = 'Domain Breakdown';
  document.querySelector('.keyboard-hint').classList.remove('active');
  
  searchInput.dispatchEvent(new Event('input'));
  
  if (currentData) {
    updateDomainView(currentData);
  }
}

document.addEventListener('click', (event) => {
  const searchContainer = document.getElementById('searchContainer');
  const searchTrigger = document.getElementById('searchTrigger');
  const searchIcon = document.querySelector('.search-icon');
  
  if (searchContainer.classList.contains('active') && 
      !searchContainer.contains(event.target) && 
      event.target !== searchTrigger &&
      event.target !== searchIcon) {
    closeSearch();
  }
});

let displayMode = 'counts';
let sortColumn = 'value';
let sortOrder = 'descending';
const defaultSortOrders = {
  domain: 'ascending',
  value: 'descending'
};
let currentData = null;
let allTabs = [];
let tabSortMode = 'firstOpened';

// Fallback favicon sizes in descending order... prioritize 16x16 since that's what we display
const FALLBACK_SIZES = [16, 32, 64];

function setFaviconWithFallback(imgElement, domain, fallbacks = FALLBACK_SIZES, index = 0) {
  if (index >= fallbacks.length) {
    // Final fallback: a generic placeholder or blank
    imgElement.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAGFBMVEUAAACAgICAgICAgICAgICAgICAgICAgICaOyBjAAAAB3RSTlMABgYGBgYGBgYGBgAAABBJREFUeNrtwQEBAAAAgiD/r25IQAEAAADKAAQXhLdbAAAAAElFTkSuQmCC'; // 32x32 gray square
    return;
  }
  
  imgElement.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=${fallbacks[index]}`;
  imgElement.onerror = () => setFaviconWithFallback(imgElement, domain, fallbacks, index + 1);
}

function updateUI(data) {
  currentData = data;
  document.getElementById('openWindows').textContent = data.openWindows;
  document.getElementById('openTabs').textContent = data.openTabs;
  document.getElementById('currentWindowTabs').textContent = data.currentWindowTabs;
  document.getElementById('currentWindowPinnedTabs').textContent = data.currentWindowPinnedTabs;
  document.getElementById('allTimeTabs').textContent = data.allTimeTabs;
  document.getElementById('maxConcurrent').textContent = data.maxConcurrentTabs;

  if (document.getElementById('domainView').classList.contains('active')) {
    updateDomainView(data);
  }
}

function updateDomainView(data) {
  document.getElementById('viewTitle').textContent = 'Domain Breakdown';
  document.querySelector('.keyboard-hint').classList.remove('active');
  const domainArray = Object.entries(data.domainCounts);
  const orderMultiplier = sortOrder === 'ascending' ? 1 : -1;
  domainArray.sort((a, b) => {
    if (sortColumn === 'domain') {
      return orderMultiplier * a[0].localeCompare(b[0]);
    } else {
      return orderMultiplier * (a[1] - b[1]);
    }
  });

  const domainTableBody = document.querySelector('#domainTable tbody');
  domainTableBody.innerHTML = '';
  const totalDomainTabs = Object.values(data.domainCounts).reduce((sum, count) => sum + count, 0) || 1;
  for (const [domain, count] of domainArray) {
    const row = document.createElement('tr');
    row.classList.add('clickable');
    
    const domainCell = document.createElement('td');
    domainCell.classList.add('domain-cell');
    const favicon = document.createElement('img');
    favicon.alt = `${domain} favicon`;
    
    if (data.domainFavicons[domain]) {
      favicon.src = data.domainFavicons[domain];
      favicon.onerror = () => setFaviconWithFallback(favicon, domain);
    } else {
      setFaviconWithFallback(favicon, domain);
    }
    
    const domainText = document.createElement('span');
    domainText.className = 'domain-name';
    domainText.textContent = domain;
    domainText.title = domain;
    domainCell.appendChild(favicon);
    domainCell.appendChild(domainText);
    
    const valueCell = document.createElement('td');
    valueCell.textContent = count;
    
    row.appendChild(domainCell);
    row.appendChild(valueCell);
    row.addEventListener('click', () => showTabsForDomain(domain));
    domainTableBody.appendChild(row);
  }

  const domainArrow = document.getElementById('domainArrow');
  const valueArrow = document.getElementById('valueArrow');
  document.getElementById('domainHeader').classList.toggle('sorted', sortColumn === 'domain');
  document.getElementById('valueHeader').classList.toggle('sorted', sortColumn === 'value');

  domainArrow.innerHTML = sortColumn === 'domain' 
    ? (sortOrder === 'ascending' 
        ? '<svg class="sort-arrow"><use href="#sort-alpha-ascending"></use></svg>' 
        : '<svg class="sort-arrow"><use href="#sort-alpha-descending"></use></svg>')
    : '<svg class="sort-arrow"><use href="#sort-alpha-descending"></use></svg>';

  valueArrow.innerHTML = sortColumn === 'value' 
    ? (sortOrder === 'ascending' 
        ? '<svg class="sort-arrow"><use href="#sort-ascending"></use></svg>' 
        : '<svg class="sort-arrow"><use href="#sort-descending"></use></svg>')
    : '<svg class="sort-arrow"><use href="#sort-descending"></use></svg>';

  const chartData = {
    labels: domainArray.map(([domain]) => domain),
    datasets: [{
      data: domainArray.map(([, count]) => count),
      backgroundColor: ['#4a90e2', '#50e3c2', '#f5a623', '#d0021b', '#9013fe', '#7ed321', '#f8e71c', '#bd10e0', '#8b572a', '#b8e986'],
    }]
  };
  const chartOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.raw;
            return `${label}: ${value}`;
          }
        }
      }
    },
    maintainAspectRatio: false
  };
  if (window.domainChart) {
    window.domainChart.data = chartData;
    window.domainChart.options = chartOptions;
    window.domainChart.update();
  } else {
    window.domainChart = new Chart(document.getElementById('domainChart'), {
      type: 'pie',
      data: chartData,
      options: chartOptions
    });
  }
}

function showTabsForDomain(domain) {
  document.getElementById('domainView').classList.remove('active');
  document.getElementById('tabView').classList.add('active');
  document.getElementById('searchView').classList.remove('active');
  document.getElementById('viewTitle').textContent = `Tabs for ${domain}`;
  document.querySelector('.keyboard-hint').classList.remove('active');
  
  chrome.runtime.sendMessage({ type: 'getTabsForDomain', domain }, (response) => {
    const tabs = response.tabs;
    tabs.sort((a, b) => {
      if (tabSortMode === 'firstOpened') {
        return a.id - b.id;
      } else {
        return b.lastAccessed - a.lastAccessed;
      }
    });

    const tabList = document.getElementById('tabList');
    tabList.innerHTML = '';
    const ul = document.createElement('ul');
    tabList.appendChild(ul);
    tabs.forEach(tab => {
      const li = document.createElement('li');
      li.textContent = tab.title;
      li.addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
        chrome.windows.update(tab.windowId, { focused: true });
      });
      ul.appendChild(li);
    });
  });
}

function showDomainView() {
  document.getElementById('tabView').classList.remove('active');
  document.getElementById('searchView').classList.remove('active');
  document.getElementById('domainView').classList.add('active');
  document.getElementById('viewTitle').textContent = 'Domain Breakdown';
  document.querySelector('.keyboard-hint').classList.remove('active');
  if (currentData) {
    updateDomainView(currentData);
  }
}

function fetchAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    allTabs = tabs.map(tab => ({
      id: tab.id,
      title: tab.title || '',
      url: tab.url || '',
      windowId: tab.windowId,
      lowerTitle: (tab.title || '').toLowerCase(),
      lowerUrl: (tab.url || '').toLowerCase()
    }));
  });
}

fetchAllTabs();
setInterval(fetchAllTabs, 5000);

const performSearch = (query, allTabs) => {
  if (!query) return [];
  
  const lowerQuery = query.toLowerCase();
  const resultMap = new Map();
  
  allTabs.forEach(tab => {
    const titleIndex = tab.lowerTitle.indexOf(lowerQuery);
    if (titleIndex !== -1) {
      resultMap.set(tab.id, {
        tab,
        match: tab.title.slice(titleIndex, titleIndex + lowerQuery.length),
        source: 'title',
        index: titleIndex,
        priority: 1
      });
    }
  });
  
  allTabs.forEach(tab => {
    if (resultMap.has(tab.id)) return;
    
    const urlIndex = tab.lowerUrl.indexOf(lowerQuery);
    if (urlIndex !== -1) {
      resultMap.set(tab.id, {
        tab, 
        match: tab.url.slice(urlIndex, urlIndex + lowerQuery.length),
        source: 'url',
        index: urlIndex,
        priority: 2
      });
    }
  });
  
  return Array.from(resultMap.values()).sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.index - b.index;
  });
};

const renderSearchResults = (results, query) => {
  const searchResults = document.getElementById('searchResults');
  searchResults.innerHTML = '';

  if (results.length === 0) {
    searchResults.innerHTML = '<div class="no-results">No tabs found matching "<b>' + query + '</b>"</div>';
    document.querySelector('.keyboard-hint').classList.remove('active');
    return;
  }

  const fragment = document.createDocumentFragment();
  const lowerQuery = query.toLowerCase();
  
  results.forEach((result, index) => {
    const panel = document.createElement('div');
    panel.classList.add('panel');
    panel.setAttribute('data-source', result.source);
    panel.style.animationDelay = `${index * 0.05}s`;
    
    const relevanceScore = result.priority === 1 ? 'high' : 'medium';
    panel.setAttribute('data-relevance', relevanceScore);

    const title = document.createElement('div');
    title.classList.add('panel-title');
    if (result.source === 'title') {
      title.textContent = result.tab.title;
    } else {
      let displayUrl = result.tab.url;
      try {
        const url = new URL(result.tab.url);
        displayUrl = url.hostname + url.pathname;
      } catch (e) {}
      title.textContent = displayUrl;
    }
    panel.appendChild(title);

    const match = document.createElement('div');
    match.classList.add('panel-match');
    
    const text = result.source === 'title' ? result.tab.title : result.tab.url;
    const lowerText = result.source === 'title' ? result.tab.lowerTitle : result.tab.lowerUrl;
    const matchIndex = lowerText.indexOf(lowerQuery);
    
    const contextStart = Math.max(0, matchIndex - 30);
    const contextEnd = Math.min(text.length, matchIndex + lowerQuery.length + 30);
    
    let displayText = text.slice(contextStart, contextEnd);
    
    if (contextStart > 0) {
      displayText = '...' + displayText;
    }
    if (contextEnd < text.length) {
      displayText = displayText + '...';
    }
    
    const adjustedMatchIndex = matchIndex - contextStart + (contextStart > 0 ? 3 : 0);
    
    const before = displayText.slice(0, adjustedMatchIndex);
    const highlighted = displayText.slice(adjustedMatchIndex, adjustedMatchIndex + lowerQuery.length);
    const after = displayText.slice(adjustedMatchIndex + lowerQuery.length);
    
    match.innerHTML = `${before}<span class="highlight">${highlighted}</span>${after}`;
    panel.appendChild(match);

    panel.addEventListener('click', () => {
      panel.style.transform = 'scale(0.98)';
      panel.style.opacity = '0.9';
      setTimeout(() => {
        chrome.tabs.update(result.tab.id, { active: true });
        chrome.windows.update(result.tab.windowId, { focused: true });
      }, 100);
    });

    fragment.appendChild(panel);
  });
  
  searchResults.appendChild(fragment);
};

let searchTimeout = null;
const DEBOUNCE_DELAY = 50;
let lastQuery = '';
const addSearchAnimations = () => {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    #searchResults .panel {
      animation: fadeInUp 0.3s ease forwards;
      animation-delay: calc(var(--index, 0) * 0.05s);
    }
  `;
  document.head.appendChild(style);
};
addSearchAnimations();

let selectedResultIndex = -1;

function updateSelectedResult(newIndex) {
  const results = document.querySelectorAll('#searchResults .panel');
  if (results.length === 0) return;
  
  if (selectedResultIndex >= 0 && selectedResultIndex < results.length) {
    results[selectedResultIndex].classList.remove('selected');
  }
  
  selectedResultIndex = Math.max(0, Math.min(newIndex, results.length - 1));
  
  results[selectedResultIndex].classList.add('selected');
  
  results[selectedResultIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    const searchContainer = document.getElementById('searchContainer');
    const searchInput = document.getElementById('searchInput');
    
    searchContainer.classList.add('active');
    document.body.classList.add('search-active');
    document.getElementById('searchTrigger').style.display = 'none';
    searchInput.focus();
    
    if (searchInput.value.trim()) {
      document.body.classList.add('search-mode');
      document.getElementById('domainView').classList.remove('active');
      document.getElementById('tabView').classList.remove('active');
      document.getElementById('searchView').classList.add('active');
    }
    return;
  }
  
  if (e.key === 'Escape') {
    const searchContainer = document.getElementById('searchContainer');
    const searchInput = document.getElementById('searchInput');
    
    if (searchContainer.classList.contains('active')) {
      if (searchInput.value.trim()) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
      } else {
        closeSearch();
      }
      e.preventDefault();
      return;
    }
  }
  
  if (!document.getElementById('searchView').classList.contains('active')) return;
  
  const results = document.querySelectorAll('#searchResults .panel');
  if (results.length === 0) return;
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      updateSelectedResult(selectedResultIndex + 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      updateSelectedResult(selectedResultIndex - 1);
      break;
    case 'Enter':
      if (selectedResultIndex >= 0 && selectedResultIndex < results.length) {
        e.preventDefault();
        results[selectedResultIndex].click();
      }
      break;
  }
});

function resetSearchSelection() {
  selectedResultIndex = -1;
  const results = document.querySelectorAll('#searchResults .panel');
  results.forEach(panel => panel.classList.remove('selected'));
}

document.getElementById('searchTrigger').addEventListener('click', () => {
  const searchContainer = document.getElementById('searchContainer');
  const searchInput = document.getElementById('searchInput');
  
  searchContainer.classList.add('active');
  document.body.classList.add('search-active');
  searchInput.focus();
  document.getElementById('searchTrigger').style.display = 'none';
  
  if (searchInput.value.trim()) {
    document.body.classList.add('search-mode');
    document.getElementById('domainView').classList.remove('active');
    document.getElementById('tabView').classList.remove('active');
    document.getElementById('searchView').classList.add('active');
  }
});

document.querySelector('.search-icon').addEventListener('click', () => {
  const searchContainer = document.getElementById('searchContainer');
  if (searchContainer.classList.contains('active')) {
    closeSearch();
  }
});

document.getElementById('searchInput').addEventListener('input', (event) => {
  const query = event.target.value.trim();
  
  if (query) {
    document.body.classList.add('search-mode');
    document.getElementById('domainView').classList.remove('active');
    document.getElementById('tabView').classList.remove('active');
    document.getElementById('searchView').classList.add('active');
    const viewTitle = document.getElementById('viewTitle');
    viewTitle.classList.add('search-results');
    viewTitle.textContent = `Searching for "${query}"`;
  } else {
    document.body.classList.remove('search-mode');
    document.getElementById('searchView').classList.remove('active');
    document.getElementById('domainView').classList.add('active');
    document.getElementById('tabView').classList.remove('active');
    const viewTitle = document.getElementById('viewTitle');
    viewTitle.classList.remove('search-results');
    viewTitle.textContent = 'Domain Breakdown';
    document.querySelector('.keyboard-hint').classList.remove('active');
    if (currentData) {
      updateDomainView(currentData);
    }
    lastQuery = '';
    return;
  }
  
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  if (query === lastQuery) {
    return;
  }
  
  lastQuery = query;
  
  searchTimeout = setTimeout(() => {
    const results = performSearch(query, allTabs);
    renderSearchResults(results, query);
    resetSearchSelection();
    
    if (results.length > 0) {
      updateSelectedResult(0);
      const keyboardHint = document.querySelector('.keyboard-hint');
      keyboardHint.classList.add('active');
      setTimeout(() => {
        keyboardHint.classList.remove('active');
      }, 6000);
    } else {
      document.querySelector('.keyboard-hint').classList.remove('active');
    }
    
    const viewTitle = document.getElementById('viewTitle');
    if (results.length === 1) {
      viewTitle.textContent = `1 tab found for "${query}"`;
    } else {
      viewTitle.textContent = `${results.length} tabs found for "${query}"`;
    }
  }, DEBOUNCE_DELAY);
});

chrome.runtime.sendMessage({ type: 'getData' }, (data) => {
  updateUI(data);
});

document.getElementById('toggleTabSort').addEventListener('click', () => {
  tabSortMode = tabSortMode === 'firstOpened' ? 'lastAccessed' : 'firstOpened';
  document.getElementById('toggleTabSort').textContent = tabSortMode === 'firstOpened' ? 'Sort by Last Accessed' : 'Sort by First Opened';
  const currentDomain = document.getElementById('viewTitle').textContent.replace('Tabs for ', '');
  showTabsForDomain(currentDomain);
});

document.getElementById('backToDomains').addEventListener('click', () => {
  showDomainView();
});

document.getElementById('resetAllTime').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'resetAllTimeTabs' });
  chrome.runtime.sendMessage({ type: 'getData' }, (data) => {
    updateUI(data);
  });
});

document.getElementById('resetMaxConcurrent').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'resetMaxConcurrentTabs' });
  chrome.runtime.sendMessage({ type: 'getData' }, (data) => {
    updateUI(data);
  });
});

document.getElementById('domainHeader').addEventListener('click', () => {
  if (sortColumn === 'domain') {
    sortOrder = sortOrder === 'ascending' ? 'descending' : 'ascending';
  } else {
    sortColumn = 'domain';
    sortOrder = defaultSortOrders.domain;
  }
  updateDomainView(currentData);
});

document.getElementById('valueHeader').addEventListener('click', () => {
  if (sortColumn === 'value') {
    sortOrder = sortOrder === 'ascending' ? 'descending' : 'ascending';
  } else {
    sortColumn = 'value';
    sortOrder = defaultSortOrders.value;
  }
  updateDomainView(currentData);
});