chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['jobCount'], (result) => {
        if (typeof result.jobCount === 'undefined') {
            chrome.storage.local.set({ jobCount: 0 });
        }
    });
    console.log('Extension installed');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com/jobs')) {
        chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        }).catch(console.error);
    }
});

// Enhanced counter sync
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'updateJobCount') {
        const count = parseInt(message.count) || 0;
        
        // Update storage first
        chrome.storage.local.set({
            jobCount: count,
            lastUpdate: Date.now()
        }).then(() => {
            // Then broadcast to all tabs
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'counterUpdated',
                        count: count
                    }).catch(() => {});
                });
            });
        });
    } else if (message.type === 'getCount') {
        chrome.storage.local.get(['jobCount'], (result) => {
            if (sender.tab) {
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: 'counterUpdated',
                    count: result.jobCount || 0
                });
            }
        });
    }
    return true;
});

// Add storage change listener
chrome.storage.onChanged.addListener((changes) => {
    if (changes.jobCount) {
        const newCount = changes.jobCount.newValue;
        // Broadcast to all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'counterUpdated',
                    count: newCount
                }).catch(() => {});
            });
        });
    }
});
