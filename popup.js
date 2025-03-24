document.getElementById('startApply').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url?.includes('linkedin.com/jobs')) {
            alert('Please navigate to LinkedIn jobs page');
            return;
        }

        document.getElementById('status').textContent = 'Running...';
        document.getElementById('startApply').disabled = true;
        document.getElementById('stopApply').disabled = false;

        await chrome.tabs.sendMessage(tab.id, { action: 'startApply' });
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('status').textContent = 'Error starting';
        document.getElementById('startApply').disabled = false;
        document.getElementById('stopApply').disabled = true;
    }
});

document.getElementById('stopApply').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        document.getElementById('status').textContent = 'Stopped';
        document.getElementById('startApply').disabled = false;
        document.getElementById('stopApply').disabled = true;
        
        await chrome.tabs.sendMessage(tab.id, { action: 'stopApply' });
    } catch (error) {
        console.error('Error stopping:', error);
    }
});

// Enhanced counter handling
let currentCount = 0;

// Update counter display with animation
function updateCounterDisplay(count) {
    const counterElement = document.getElementById('jobCount');
    if (counterElement) {
        currentCount = parseInt(count) || 0;
        counterElement.textContent = currentCount.toString();
        counterElement.style.animation = 'pulse 0.5s';
        setTimeout(() => {
            counterElement.style.animation = '';
        }, 500);
        console.log('Updated popup counter:', currentCount);
    }
}

// Add listener for counter updates
chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.type === 'updateJobCount' || message.type === 'counterUpdated') {
        const newCount = parseInt(message.count) || 0;
        if (newCount !== currentCount) {
            updateCounterDisplay(newCount);
        }
    }
});

// Load counter when popup opens
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const result = await chrome.storage.local.get(['jobCount']);
        updateCounterDisplay(result.jobCount || 0);
        
        // Get fresh count from active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            chrome.tabs.sendMessage(tab.id, { action: 'getCount' });
        }
    } catch (error) {
        console.error('Error loading counter:', error);
    }
});

// Add CSS for counter animation
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }
    #jobCount {
        display: inline-block;
    }
`;
document.head.appendChild(style);
