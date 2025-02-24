let displayMode = 'counts';
let sortColumn = 'value'; // Default sort column
let sortOrder = 'descending'; // Default sort order
const defaultSortOrders = {
  domain: 'ascending', // Default for domain: A-Z
  value: 'descending' // Default for value: highest first
};
let currentData = null;
let allTabs = [];
let tabSortMode = 'firstOpened'; // Default sort mode for tabs

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
    } else { // sortColumn === 'value'
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
    domainCell.textContent = domain;
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

  // Update sort arrows
  document.getElementById('domainArrow').textContent = sortColumn === 'domain' ? (sortOrder === 'ascending' ? '▲' : '▼') : '↕';
  document.getElementById('valueArrow').textContent = sortColumn === 'value' ? (sortOrder === 'ascending' ? '▲' : '▼') : '↕';

  const chartData = {
    labels: domainArray.map(([domain]) => domain),
    datasets: [{
      data: displayMode === 'counts' 
        ? domainArray.map(([, count]) => count) 
        : domainArray.map(([, count]) => (count / totalDomainTabs * 100).toFixed(2)),
      backgroundColor: ['#ff6384', '#36a2eb', '#cc65fe', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf', '#e7e9ed', '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4'],
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
        return a.id - b.id; // Lower ID = older tab
      } else {
        return b.lastAccessed - a.lastAccessed; // Higher lastAccessed = more recent
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

// Fetch all tabs for search
function fetchAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    allTabs = tabs.map(tab => ({ id: tab.id, title: tab.title, url: tab.url, windowId: tab.windowId }));
  });
}

fetchAllTabs();

// Debounce function to limit search frequency
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Exact string matching function
function exactSearch(query, text) {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return null;
  return text.slice(index, index + query.length); // Return the exact match
}

// Handle search input
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

  const results = allTabs.map(tab => {
    const titleMatch = exactSearch(query, tab.title);
    const urlMatch = exactSearch(query, tab.url);
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
    return;
  }

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
    const matchIndex = text.toLowerCase().indexOf(result.match.toLowerCase());
    const before = text.slice(0, matchIndex);
    const highlighted = text.slice(matchIndex, matchIndex + result.match.length);
    const after = text.slice(matchIndex + result.match.length);
    match.innerHTML = `${before}<span class="highlight">${highlighted}</span>${after}`;
    panel.appendChild(match);

    panel.addEventListener('click', () => {
      chrome.tabs.update(result.tab.id, { active: true });
      chrome.windows.update(result.tab.windowId, { focused: true });
    });

    searchResults.appendChild(panel);
  });
}, 300));

// On load, fetch data and update UI
chrome.runtime.sendMessage({ type: 'getData' }, (data) => {
  updateUI(data);
});

// Toggle between counts and proportions
document.getElementById('toggleMode').addEventListener('click', () => {
  displayMode = displayMode === 'counts' ? 'proportions' : 'counts';
  document.getElementById('toggleMode').textContent = displayMode === 'counts' ? 'Switch to Proportions' : 'Switch to Counts';
  if (currentData) {
    updateDomainView(currentData);
  }
});

// Toggle tab sort mode
document.getElementById('toggleTabSort').addEventListener('click', () => {
  tabSortMode = tabSortMode === 'firstOpened' ? 'lastAccessed' : 'firstOpened';
  document.getElementById('toggleTabSort').textContent = tabSortMode === 'firstOpened' ? 'Sort by Last Accessed' : 'Sort by First Opened';
  const currentDomain = document.getElementById('viewTitle').textContent.replace('Tabs for ', '');
  showTabsForDomain(currentDomain);
});

// Back to domain view
document.getElementById('backToDomains').addEventListener('click', () => {
  showDomainView();
});

// Reset all-time tabs
document.getElementById('resetAllTime').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'resetAllTimeTabs' });
  chrome.runtime.sendMessage({ type: 'getData' }, (data) => {
    updateUI(data);
  });
});

// Reset max concurrent tabs
document.getElementById('resetMaxConcurrent').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'resetMaxConcurrentTabs' });
  chrome.runtime.sendMessage({ type: 'getData' }, (data) => {
    updateUI(data);
  });
});

// Add event listeners for sorting
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