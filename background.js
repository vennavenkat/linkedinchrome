chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ jobCount: 0 });
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

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'updateJobCount') {
        chrome.storage.local.set({ jobCount: message.count });
    }
});
