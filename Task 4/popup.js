document.addEventListener('DOMContentLoaded', async () => {
  await loadTodayStats();
  setupEventListeners();
});

async function loadTodayStats() {
  try {
    const result = await chrome.storage.local.get(['dailyStats', 'socialMediaStats', 'settings']);
    const dailyStats = result.dailyStats || {};
    const socialMediaStats = result.socialMediaStats || {};
    const settings = result.settings || { trackingEnabled: true };
    
    const today = new Date().toDateString();
    const todayData = dailyStats[today] || {};
    const todaySocialData = socialMediaStats[today] || { totalTime: 0, platforms: {} };
    
    // Calculate productivity metrics
    const metrics = calculateProductivityMetrics(todayData);
    
    // Update UI
    document.getElementById('productivityScore').textContent = `${metrics.productivityScore}%`;
    document.getElementById('productiveTime').textContent = formatTime(metrics.productiveTime);
    document.getElementById('unproductiveTime').textContent = formatTime(metrics.unproductiveTime);
    document.getElementById('socialMediaTime').textContent = formatTime(todaySocialData.totalTime);
    document.getElementById('totalTime').textContent = formatTime(metrics.totalTime);
    
    // Update top sites and social media breakdown
    displayTopSites(todayData);
    displaySocialMediaBreakdown(todaySocialData.platforms);
    
    // Update toggle button
    const toggleBtn = document.getElementById('toggleTracking');
    toggleBtn.textContent = settings.trackingEnabled ? 'Tracking ON' : 'Tracking OFF';
    toggleBtn.classList.toggle('active', settings.trackingEnabled);
    
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function displaySocialMediaBreakdown(platforms) {
  const socialMediaList = document.getElementById('socialMediaList');
  socialMediaList.innerHTML = '';
  
  if (Object.keys(platforms).length === 0) {
    socialMediaList.innerHTML = '<p style="opacity: 0.6; font-size: 0.9em;">No social media usage today! 🎉</p>';
    return;
  }
  
  // Sort platforms by time spent
  const sortedPlatforms = Object.entries(platforms)
    .sort(([,a], [,b]) => b - a);
  
  sortedPlatforms.forEach(([platform, time]) => {
    const platformItem = document.createElement('div');
    platformItem.className = 'stat-item';
    platformItem.style.fontSize = '0.85em';
    
    // Add platform emoji
    const emoji = getPlatformEmoji(platform);
    
    platformItem.innerHTML = `
      <span style="color: #fc8181;">${emoji} ${platform}:</span>
      <span>${formatTime(time)}</span>
    `;
    
    socialMediaList.appendChild(platformItem);
  });
}

function getPlatformEmoji(platform) {
  const emojiMap = {
    'Facebook': '📘',
    'Twitter/X': '🐦',
    'Instagram': '📸',
    'TikTok': '🎵',
    'YouTube': '📺',
    'LinkedIn': '💼',
    'Pinterest': '📌',
    'Snapchat': '👻',
    'Discord': '🎮',
    'Reddit': '🤖',
    'Twitch': '🎬',
    'WhatsApp': '💬',
    'Telegram': '✈️'
  };
  return emojiMap[platform] || '📱';
}

function calculateProductivityMetrics(todayData) {
  let productiveTime = 0;
  let unproductiveTime = 0;
  let neutralTime = 0;
  
  Object.entries(todayData).forEach(([domain, time]) => {
    const category = classifyWebsite(domain);
    switch (category) {
      case 'productive':
        productiveTime += time;
        break;
      case 'unproductive':
        unproductiveTime += time;
        break;
      default:
        neutralTime += time;
    }
  });
  
  const totalTime = productiveTime + unproductiveTime + neutralTime;
  const productivityScore = totalTime > 0 ? 
    Math.round((productiveTime / totalTime) * 100) : 0;
  
  return {
    productiveTime,
    unproductiveTime,
    neutralTime,
    totalTime,
    productivityScore
  };
}

function classifyWebsite(domain) {
  const productive = [
    'github.com', 'stackoverflow.com', 'developer.mozilla.org',
    'docs.google.com', 'codepen.io', 'replit.com', 'leetcode.com',
    'coursera.org', 'udemy.com', 'khanacademy.org', 'medium.com',
    'notion.so', 'trello.com', 'slack.com', 'zoom.us', 'teams.microsoft.com',
    'atlassian.com', 'jira.atlassian.com', 'confluence.atlassian.com',
    'figma.com', 'canva.com', 'dribbble.com', 'behance.net',
    'w3schools.com', 'freecodecamp.org', 'codecademy.com', 'pluralsight.com'
  ];
  const unproductive = [
    // Traditional Social Media
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 
    'snapchat.com', 'linkedin.com', 'pinterest.com',
    
    // Video/Entertainment Platforms
    'youtube.com', 'netflix.com', 'hulu.com', 'disney.com', 'primevideo.com',
    'tiktok.com', 'twitch.tv', 'mixer.com', 'vimeo.com',
    
    // Gaming/Entertainment
    'reddit.com', 'imgur.com', '9gag.com', 'buzzfeed.com', 'vice.com',
    'discord.com', 'steam.com', 'epicgames.com', 'battle.net',
    
    // Shopping
    'amazon.com', 'ebay.com', 'etsy.com', 'shopify.com', 'aliexpress.com',
    'zalando.com', 'asos.com', 'target.com', 'walmart.com',
    
    // News/Entertainment (when used for leisure browsing)
    'cnn.com', 'bbc.com', 'dailymail.co.uk', 'tmz.com', 'celebrity.com',
    'gossip.com', 'entertainment.com', 'hollywood.com',
    
    // Dating Apps (web versions)
    'tinder.com', 'bumble.com', 'match.com', 'eharmony.com',
    
    // Music/Audio Entertainment
    'spotify.com', 'soundcloud.com', 'pandora.com', 'apple.com/music',
    
    // Messaging/Chat (when used for personal purposes)
    'whatsapp.com', 'telegram.org', 'messenger.com', 'skype.com',
    
    // Memes/Fun Content
    'meme.com', 'ifunny.co', 'cheezburger.com', 'memegenerator.net'
  ];
  
  if (productive.some(site => domain.includes(site))) return 'productive';
  if (unproductive.some(site => domain.includes(site))) return 'unproductive';
  return 'neutral';
}

function displayTopSites(todayData) {
  const topSitesList = document.getElementById('topSitesList');
  topSitesList.innerHTML = '';
  
  // Sort sites by time spent
  const sortedSites = Object.entries(todayData)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  sortedSites.forEach(([domain, time]) => {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';
    
    const category = classifyWebsite(domain);
    const categoryClass = category === 'productive' ? 'productive' : 
                         category === 'unproductive' ? 'unproductive' : '';
    
    siteItem.innerHTML = `
      <span class="site-name ${categoryClass}">${domain}</span>
      <span class="site-time">${formatTime(time)}</span>
    `;
    
    topSitesList.appendChild(siteItem);
  });
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

function setupEventListeners() {
  // Toggle tracking
  document.getElementById('toggleTracking').addEventListener('click', async () => {
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || {};
    settings.trackingEnabled = !settings.trackingEnabled;
    
    await chrome.storage.local.set({ settings });
    await loadTodayStats();
  });
  
  // Open dashboard
  document.getElementById('openDashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
}