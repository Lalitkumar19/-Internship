// Track user activity on the current page
let isActive = true;
let activityTimer = null;

// Track when user becomes inactive
function resetActivityTimer() {
  clearTimeout(activityTimer);
  
  if (!isActive) {
    isActive = true;
    chrome.runtime.sendMessage({ action: 'pageActive' });
  }
  
  activityTimer = setTimeout(() => {
    isActive = false;
    chrome.runtime.sendMessage({ action: 'pageInactive' });
  }, 60000); // 1 minute of inactivity
}

// Listen for user interactions
document.addEventListener('mousemove', resetActivityTimer);
document.addEventListener('keypress', resetActivityTimer);
document.addEventListener('scroll', resetActivityTimer);
document.addEventListener('click', resetActivityTimer);

// Initialize activity tracking
resetActivityTimer();

// Send page info to background script
chrome.runtime.sendMessage({
  action: 'pageLoaded',
  url: window.location.href,
  domain: window.location.hostname,
  title: document.title
});