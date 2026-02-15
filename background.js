importScripts('./utils/analytics.js');

chrome.runtime.onInstalled.addListener(() => {
  // onInstalled event fired
  try {
    Analytics.fireEvent('extension_installed');
    // Remove existing menu item if it exists to avoid duplicates
    chrome.contextMenus.remove('smarttranslate_selection', () => {
      // Ignore errors if it doesn't exist
      chrome.runtime.lastError;
    });

    // Create the context menu item
    chrome.contextMenus.create({
      id: 'smarttranslate_selection',
      title: 'Translate / Explain selection with AI Assistant',
      contexts: ['selection']
    });
    // context menu created
  } catch (e) {
    console.error('Failed to create context menu:', e);
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // context menu clicked
  if (info.menuItemId !== 'smarttranslate_selection' || !tab) {
    return;
  }

  // If the tab is a PDF, open the popup in a new window
  // PDF-specific flow removed to simplify the extension (handled via inline popup only)

  // Sending message to content script
  // Make sure we have a valid tab and it's a supported URL
  if (!tab.id || tab.id < 0) {
    return;
  }

  // Check if we can access the tab
  try {
    // Try to get the tab info first to verify it's accessible
    await chrome.tabs.get(tab.id);

    // Send message to the content script
    chrome.tabs.sendMessage(
      tab.id,
      {
        type: 'smarttranslate:show-popup',
        selection: info.selectionText || ''
      },
      (response) => {
        if (chrome.runtime.lastError) {
          // message send failed
          return;
        }
        // message sent successfully
        try { Analytics.fireEvent('context_menu_used'); } catch (e) { }
      }
    );
  } catch (error) {
    console.error('[SmartTranslate] Error accessing tab:', error);
  }
});

// Relay messages from content scripts (e.g. iframes) to the top frame
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYTICS_EVENT') {
    Analytics.fireEvent(message.name, message.params);
    return false; // No response needed
  }

  if (message.type === 'smarttranslate:show-popup') {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, message, (response) => {
        // Propagate response back to sender if needed
        if (chrome.runtime.lastError) {
          console.warn('Background relay failed:', chrome.runtime.lastError.message);
        } else {
          sendResponse(response);
        }
      });
      return true; // Keep channel open for async response
    }
  }
});
