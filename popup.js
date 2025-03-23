document.getElementById('startApply').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.includes('linkedin.com/jobs')) {
            alert('Please navigate to LinkedIn jobs page');
            return;
        }

        document.getElementById('status').textContent = 'Starting...';
        document.getElementById('startApply').disabled = true;
        document.getElementById('stopApply').disabled = false;

        // Inject content script and start automation
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        });

        // Wait for script to load
        await new Promise(r => setTimeout(r, 1000));
        chrome.tabs.sendMessage(tab.id, { action: 'startApply' });

    } catch (error) {
        console.error('Error:', error);
        alert('Error: Make sure you are on LinkedIn jobs page');
        document.getElementById('status').textContent = 'Error';
        document.getElementById('startApply').disabled = false;
    }
});

document.getElementById('stopApply').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    document.getElementById('status').textContent = 'Stopped';
    document.getElementById('startApply').disabled = false;
    document.getElementById('stopApply').disabled = true;
    
    chrome.tabs.sendMessage(tab.id, { action: 'stopApply' });
});

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'updateJobCount') {
        document.getElementById('jobCount').textContent = message.count;
    }
});
