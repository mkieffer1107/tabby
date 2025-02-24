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

function updateUI(data) {
  currentData = data;
  document.getElementById('openWindows').textContent = data.openWindows;
  document.getElementById('openTabs').textContent = data.openTabs;
  document.getElementById('currentWindowTabs').textContent = data.currentWindowTabs;
  document.getElementById('allTimeTabs').textContent = data.allTimeTabs;
  document.getElementById('maxConcurrent').textContent = data.maxConcurrentTabs;

  if (document.getElementById('domainView').classList.contains('active')) {
    updateDomainView(data);
  }
}

function updateDomainView(data) {
  document.getElementById('viewTitle').textContent = 'Domain Breakdown';
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
    favicon.src = `https://www.google.com/s2/favicons?domain=${domain}`;
    favicon.alt = `${domain} favicon`;
    const domainText = document.createElement('span');
    domainText.className = 'domain-name'; // Added class for truncation
    domainText.textContent = domain;
    domainText.title = domain; // Added tooltip for full domain name
    domainCell.appendChild(favicon);
    domainCell.appendChild(domainText);
    
    const valueCell = document.createElement('td');
    if (displayMode === 'counts') {
      valueCell.textContent = count;
    } else {
      const percentage = (count / totalDomainTabs * 100).toFixed(2) + '%';
      valueCell.textContent = percentage;
    }
    
    row.appendChild(domainCell);
    row.appendChild(valueCell);
    row.addEventListener('click', () => showTabsForDomain(domain));
    domainTableBody.appendChild(row);
  }

  // Update sort indicators with SVG icons
  const domainArrow = document.getElementById('domainArrow');
  const valueArrow = document.getElementById('valueArrow');
  document.getElementById('domainHeader').classList.toggle('sorted', sortColumn === 'domain');
  document.getElementById('valueHeader').classList.toggle('sorted', sortColumn === 'value');

  // Domain column uses alphabetical sort icons
  domainArrow.innerHTML = sortColumn === 'domain' 
    ? (sortOrder === 'ascending' 
        ? '<svg class="sort-arrow"><use href="#sort-alpha-ascending"></use></svg>' 
        : '<svg class="sort-arrow"><use href="#sort-alpha-descending"></use></svg>')
    : '<svg class="sort-arrow"><use href="#sort-alpha-descending"></use></svg>'; // Default to descending for domain

  // Value column uses numerical sort icons
  valueArrow.innerHTML = sortColumn === 'value' 
    ? (sortOrder === 'ascending' 
        ? '<svg class="sort-arrow"><use href="#sort-ascending"></use></svg>' 
        : '<svg class="sort-arrow"><use href="#sort-descending"></use></svg>')
    : '<svg class="sort-arrow"><use href="#sort-descending"></use></svg>'; // Default to descending for value

  const chartData = {
    labels: domainArray.map(([domain]) => domain),
    datasets: [{
      data: displayMode === 'counts' 
        ? domainArray.map(([, count]) => count) 
        : domainArray.map(([, count]) => (count / totalDomainTabs * 100).toFixed(2)),
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
            if (displayMode === 'counts') {
              return `${label}: ${value}`;
            } else {
              return `${label}: ${value}%`;
            }
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
  if (currentData) {
    updateDomainView(currentData);
  }
}

function fetchAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    allTabs = tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      url: tab.url,
      windowId: tab.windowId,
      lowerTitle: tab.title.toLowerCase(),
      lowerUrl: tab.url.toLowerCase()
    }));
  });
}

fetchAllTabs();

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function exactSearch(lowerQuery, lowerText, text) {
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return null;
  return text.slice(index, index + lowerQuery.length);
}

document.getElementById('searchInput').addEventListener('input', debounce((event) => {
  const query = event.target.value.trim();
  if (query.length === 0) {
    document.getElementById('searchView').classList.remove('active');
    document.getElementById('domainView').classList.add('active');
    document.getElementById('tabView').classList.remove('active');
    document.getElementById('viewTitle').textContent = 'Domain Breakdown';
    if (currentData) {
      updateDomainView(currentData);
    }
    return;
  }

  document.getElementById('domainView').classList.remove('active');
  document.getElementById('tabView').classList.remove('active');
  document.getElementById('searchView').classList.add('active');
  document.getElementById('viewTitle').textContent = 'Search Results';

  const lowerQuery = query.toLowerCase();
  const results = allTabs.map(tab => {
    const titleMatch = exactSearch(lowerQuery, tab.lowerTitle, tab.title);
    const urlMatch = exactSearch(lowerQuery, tab.lowerUrl, tab.url);
    return {
      tab,
      match: titleMatch || urlMatch,
      source: titleMatch ? 'title' : 'url'
    };
  }).filter(result => result.match);

  const searchResults = document.getElementById('searchResults');
  searchResults.innerHTML = '';

  if (results.length === 0) {
    searchResults.innerHTML = '<p>No tabs found.</p>';
  } else {
    const fragment = document.createDocumentFragment();
    results.forEach(result => {
      const panel = document.createElement('div');
      panel.classList.add('panel');

      const title = document.createElement('div');
      title.classList.add('panel-title');
      title.textContent = result.source === 'title' ? result.tab.title : result.tab.url;
      panel.appendChild(title);

      const match = document.createElement('div');
      match.classList.add('panel-match');
      const text = result.source === 'title' ? result.tab.title : result.tab.url;
      const lowerText = result.source === 'title' ? result.tab.lowerTitle : result.tab.lowerUrl;
      const matchIndex = lowerText.indexOf(lowerQuery);
      const before = text.slice(0, matchIndex);
      const highlighted = text.slice(matchIndex, matchIndex + lowerQuery.length);
      const after = text.slice(matchIndex + lowerQuery.length);
      match.innerHTML = `${before}<span class="highlight">${highlighted}</span>${after}`;
      panel.appendChild(match);

      panel.addEventListener('click', () => {
        chrome.tabs.update(result.tab.id, { active: true });
        chrome.windows.update(result.tab.windowId, { focused: true });
      });

      fragment.appendChild(panel);
    });
    searchResults.appendChild(fragment);
  }
}, 100));

chrome.runtime.sendMessage({ type: 'getData' }, (data) => {
  updateUI(data);
});

document.getElementById('toggleMode').addEventListener('click', () => {
  displayMode = displayMode === 'counts' ? 'proportions' : 'counts';
  document.getElementById('toggleMode').textContent = displayMode === 'counts' ? 'Switch to Proportions' : 'Switch to Counts';
  if (currentData) {
    updateDomainView(currentData);
  }
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