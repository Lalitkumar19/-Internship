// Website categories for productivity classification
const WEBSITE_CATEGORIES = {
  productive: [
    'github.com', 'stackoverflow.com', 'developer.mozilla.org',
    'docs.google.com', 'codepen.io', 'replit.com', 'leetcode.com',
    'coursera.org', 'udemy.com', 'khanacademy.org', 'medium.com',
    'notion.so', 'trello.com', 'slack.com', 'zoom.us', 'teams.microsoft.com',
    'atlassian.com', 'jira.atlassian.com', 'confluence.atlassian.com',
    'figma.com', 'canva.com', 'dribbble.com', 'behance.net',
    'w3schools.com', 'freecodecamp.org', 'codecademy.com', 'pluralsight.com'
  ],
  unproductive: [
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
  ]
};

let activeTabInfo = {
  url: '',
  startTime: null,
  domain: ''
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    dailyStats: {},
    socialMediaStats: {},
    weeklyStats: {},
    settings: { trackingEnabled: true }
  });
  
  // Create alarm for daily reset
  chrome.alarms.create('dailyReset', { 
    delayInMinutes: 1,
    periodInMinutes: 1440 // 24 hours
  });
});

// Track tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await saveCurrentTabTime();
  await startTrackingNewTab(activeInfo.tabId);
});

// Track URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    await saveCurrentTabTime();
    await startTrackingNewTab(tabId);
  }
});

// Save time when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await saveCurrentTabTime();
});

async function startTrackingNewTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && !tab.url.startsWith('chrome://')) {
      const domain = new URL(tab.url).hostname.replace('www.', '');
      activeTabInfo = {
        url: tab.url,
        startTime: Date.now(),
        domain: domain
      };
    }
  } catch (error) {
    console.log('Error tracking tab:', error);
  }
}

// Enhanced background script with social media specific tracking
async function saveCurrentTabTime() {
  if (!activeTabInfo.startTime || !activeTabInfo.domain) return;
  
  const timeSpent = Date.now() - activeTabInfo.startTime;
  const today = new Date().toDateString();
  
  // Get current stats
  const result = await chrome.storage.local.get(['dailyStats', 'socialMediaStats']);
  const dailyStats = result.dailyStats || {};
  const socialMediaStats = result.socialMediaStats || {};
  
  // Initialize today's stats if needed
  if (!dailyStats[today]) {
    dailyStats[today] = {};
  }
  if (!socialMediaStats[today]) {
    socialMediaStats[today] = { totalTime: 0, platforms: {} };
  }
  
  // Add time to domain
  if (!dailyStats[today][activeTabInfo.domain]) {
    dailyStats[today][activeTabInfo.domain] = 0;
  }
  dailyStats[today][activeTabInfo.domain] += timeSpent;
  
  // Track social media specifically
  if (isSocialMediaPlatform(activeTabInfo.domain)) {
    socialMediaStats[today].totalTime += timeSpent;
    const platform = getSocialMediaPlatform(activeTabInfo.domain);
    if (!socialMediaStats[today].platforms[platform]) {
      socialMediaStats[today].platforms[platform] = 0;
    }
    socialMediaStats[today].platforms[platform] += timeSpent;
  }
  
  // Save updated stats
  await chrome.storage.local.set({ dailyStats, socialMediaStats });
  
  // Reset tracking
  activeTabInfo = { url: '', startTime: null, domain: '' };
}

function isSocialMediaPlatform(domain) {
  const socialPlatforms = [
    'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 
    'snapchat.com', 'linkedin.com', 'pinterest.com', 'tiktok.com',
    'youtube.com', 'discord.com', 'reddit.com', 'twitch.tv',
    'whatsapp.com', 'telegram.org', 'messenger.com'
  ];
  return socialPlatforms.some(platform => domain.includes(platform));
}

function getSocialMediaPlatform(domain) {
  if (domain.includes('facebook.com') || domain.includes('messenger.com')) return 'Facebook';
  if (domain.includes('twitter.com') || domain.includes('x.com')) return 'Twitter/X';
  if (domain.includes('instagram.com')) return 'Instagram';
  if (domain.includes('tiktok.com')) return 'TikTok';
  if (domain.includes('youtube.com')) return 'YouTube';
  if (domain.includes('linkedin.com')) return 'LinkedIn';
  if (domain.includes('pinterest.com')) return 'Pinterest';
  if (domain.includes('snapchat.com')) return 'Snapchat';
  if (domain.includes('discord.com')) return 'Discord';
  if (domain.includes('reddit.com')) return 'Reddit';
  if (domain.includes('twitch.tv')) return 'Twitch';
  if (domain.includes('whatsapp.com')) return 'WhatsApp';
  if (domain.includes('telegram.org')) return 'Telegram';
  return 'Other Social Media';
}

function classifyWebsite(domain) {
  if (WEBSITE_CATEGORIES.productive.some(site => domain.includes(site))) {
    return 'productive';
  }
  if (WEBSITE_CATEGORIES.unproductive.some(site => domain.includes(site))) {
    return 'unproductive';
  }
  return 'neutral';
}

// Handle daily reset
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReset') {
    await updateWeeklyStats();
  }
});

async function updateWeeklyStats() {
  const result = await chrome.storage.local.get(['dailyStats', 'weeklyStats']);
  const dailyStats = result.dailyStats || {};
  const weeklyStats = result.weeklyStats || {};
  
  const today = new Date().toDateString();
  const weekKey = getWeekKey(new Date());
  
  if (!weeklyStats[weekKey]) {
    weeklyStats[weekKey] = {};
  }
  
  // Aggregate today's data into weekly stats
  if (dailyStats[today]) {
    Object.entries(dailyStats[today]).forEach(([domain, time]) => {
      if (!weeklyStats[weekKey][domain]) {
        weeklyStats[weekKey][domain] = 0;
      }
      weeklyStats[weekKey][domain] += time;
    });
  }
  
  await chrome.storage.local.set({ weeklyStats });
}

function getWeekKey(date) {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  return startOfWeek.toDateString();
}