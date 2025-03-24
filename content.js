console.log('LinkedIn Easy Apply content script loaded');

let isAutomating = false;
let jobsApplied = 0;
let fab = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message);
    
    if (message.action === 'startApply') {
        if (!isAutomating) {
            console.log('Starting automation');
            isAutomating = true;
            jobsApplied = 0;
            applyToJobs();
            sendResponse({ status: 'started' });
        }
    } else if (message.action === 'stopApply') {
        console.log('Stopping automation');
        isAutomating = false;
        sendResponse({ status: 'stopped' });
    }
    return true;
});

async function waitForElement(selector, timeout = 3000) { // Reduced from 5000
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const element = document.querySelector(selector);
        if (element) return element;
        await new Promise(r => setTimeout(r, 300)); // Reduced from 500
    }
    return null;
}

async function selectPhoneCountryCode() {
    try {
        // Wait for the phone country select to be available
        const phoneSelect = await waitForElement('select[id*="phoneNumber-country"]') ||
                          await waitForElement('select[id*="phone-country"]') ||
                          await waitForElement('select[aria-label*="country code"]');
        
        if (phoneSelect) {
            console.log('Found phone country selector');
            // Look for US option with different possible formats
            const options = Array.from(phoneSelect.options);
            const usOption = options.find(opt => 
                opt.value === 'US' || 
                opt.value === 'United States' ||
                opt.textContent.includes('United States') ||
                (opt.textContent.includes('+1') && opt.textContent.includes('US'))
            );

            if (usOption) {
                console.log('Setting phone country to US');
                phoneSelect.value = usOption.value;
                phoneSelect.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }
    } catch (error) {
        console.error('Error setting phone country:', error);
    }
    return false;
}

async function handleFormFields() {
    try {
        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        for (const input of inputs) {
            const fieldName = (
                input.getAttribute('name') ||
                input.getAttribute('id') ||
                input.getAttribute('aria-label') ||
                input.labels?.[0]?.textContent ||
                input.previousElementSibling?.textContent ||
                input.placeholder ||
                ''
            ).toLowerCase();
            
            const isRequired = fieldName.includes('*') || input.required;
            console.log('Processing field:', fieldName, 'Required:', isRequired);

            let valueSet = false;

            // Try specific field matches first
            if ((fieldName.includes('full') && fieldName.includes('name')) || 
                fieldName.includes('legal') || 
                (fieldName.includes('complete') && fieldName.includes('name'))) {
                await fillInput(input, 'Venkat Kumar Venna');
                valueSet = true;
            } else if (fieldName.includes('first') && fieldName.includes('name')) {
                await fillInput(input, 'Venkat Kumar');
                valueSet = true;
            } else if (fieldName.includes('last') && fieldName.includes('name')) {
                await fillInput(input, 'Venna');
                valueSet = true;
            } else if (fieldName.includes('phone') || fieldName.includes('mobile') || fieldName.includes('cell')) {
                await fillInput(input, '3477705870');
                valueSet = true;
            }

            // Use '5' as fallback only if required and no other value was set
            if (!valueSet && isRequired && input.value === '') {
                console.log('Using fallback value 5 for field:', fieldName);
                await fillInput(input, '5');
            }
        }

        // Handle radio buttons and checkboxes
        const questions = document.querySelectorAll('fieldset, .jobs-easy-apply-form-section, .jobs-easy-apply-form-element');
        for (const question of questions) {
            const questionText = (
                question.querySelector('legend')?.textContent ||
                question.querySelector('label')?.textContent ||
                question.textContent ||
                ''
            ).toLowerCase();

            console.log('Processing question:', questionText);

            if (questionText.includes('sponsorship') || questionText.includes('visa')) {
                await selectRadioOption(question, 'no');
            } else {
                // Default to "Yes" for other questions
                await selectRadioOption(question, 'yes');
            }
        }

        // Handle select dropdowns
        const selects = document.querySelectorAll('select');
        for (const select of selects) {
            if (!select.value) {
                await handleSelect(select);
            }
        }
    } catch (error) {
        console.error('Error filling form fields:', error);
    }
}

async function fillInput(input, value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    // Some LinkedIn forms need focus/blur events
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50)); // Reduced from 100
}

async function selectRadioOption(container, value) {
    const radios = container.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
        if (
            radio.value.toLowerCase() === value.toLowerCase() ||
            radio.parentElement?.textContent.toLowerCase().includes(value.toLowerCase())
        ) {
            radio.checked = true;
            radio.click();
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 50)); // Reduced from 100
            break;
        }
    }
}

async function handleSelect(select) {
    const options = Array.from(select.options);
    for (const option of options) {
        const value = option.value.toLowerCase();
        const text = option.textContent.toLowerCase();
        if (
            value.includes('5') ||
            text.includes('5') ||
            value.includes('yes') ||
            text.includes('yes')
        ) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            await new Promise(r => setTimeout(r, 50)); // Reduced from 100
            break;
        }
    }
}

async function handleApplicationModal() {
    try {
        console.log('Waiting for application modal...');
        const modal = await waitForElement('.jobs-easy-apply-modal');
        if (!modal) return false;

        while (isAutomating) {
            await handleFormFields();
            await new Promise(r => setTimeout(r, 500));
            await selectPhoneCountryCode();
            await new Promise(r => setTimeout(r, 500));

            const nextButton = document.querySelector('button[aria-label="Continue to next step"]');
            const reviewButton = document.querySelector('button[aria-label="Review your application"]');
            const submitButton = document.querySelector('button[aria-label="Submit application"]');
            const doneButton = document.querySelector('button[aria-label="Done"]') ||
                             document.querySelector('button[aria-label="Dismiss"]');
            
            if (doneButton && document.querySelector('.artdeco-modal__content')?.textContent.includes('applied')) {
                console.log('Application successful, clicking Done');
                doneButton.click();
                await new Promise(r => setTimeout(r, 500));
                return true;
            } else if (submitButton) {
                console.log('Found submit button, clicking...');
                submitButton.click();
                await new Promise(r => setTimeout(r, 1000));
                // Don't return here, wait for Done button
            } else if (nextButton) {
                console.log('Found next button, clicking...');
                nextButton.click();
                await new Promise(r => setTimeout(r, 800));
            } else if (reviewButton) {
                console.log('Found review button, clicking...');
                reviewButton.click();
                await new Promise(r => setTimeout(r, 800));
            } else if (doneButton) {
                console.log('Application possibly failed, clicking Done/Dismiss');
                doneButton.click();
                await new Promise(r => setTimeout(r, 500));
                return false;
            }
            
            await new Promise(r => setTimeout(r, 800));
        }
    } catch (error) {
        console.error('Error in modal:', error);
        return false;
    }
}

async function isJobAlreadyApplied() {
    const appliedStatus = document.querySelector('.jobs-details-top-card__content-container .artdeco-inline-feedback--success');
    const appliedBadge = document.querySelector('.jobs-details-top-card__content-container .artdeco-inline-feedback');
    return appliedStatus?.textContent.includes('Applied') || appliedBadge?.textContent.includes('Applied');
}

async function findNextJob() {
    try {
        // Wait for job list to load
        await new Promise(r => setTimeout(r, 2000));
        
        // Get all job cards with the correct class combination
        const jobCards = Array.from(document.querySelectorAll('.job-card-container.job-card-list.job-card-container--clickable:not([data-processed="true"])'));
        
        console.log(`Found ${jobCards.length} unprocessed job cards`);
        
        if (jobCards.length === 0) {
            // Try next page
            const nextButton = document.querySelector('button[aria-label="Next"]');
            if (nextButton && !nextButton.disabled) {
                console.log('Moving to next page...');
                nextButton.scrollIntoView({ behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 1000));
                nextButton.click();
                await new Promise(r => setTimeout(r, 3000));
                // Reset processed state for new page
                document.querySelectorAll('.job-card-container[data-processed]')
                    .forEach(card => card.removeAttribute('data-processed'));
                return true;
            }
            return false;
        }

        // Get the first unprocessed job
        const nextJob = jobCards[0];
        nextJob.setAttribute('data-processed', 'true');

        // Find the job title link within the card
        const jobLink = nextJob.querySelector('a.job-card-list__title, a[href*="/jobs/view/"]');
        if (jobLink) {
            console.log('Found next job:', jobLink.textContent.trim());
            // Scroll the job into view
            nextJob.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 1500));
            
            // Click the job
            jobLink.click();
            await new Promise(r => setTimeout(r, 2000));
            return true;
        }

        return false;
    } catch (error) {
        console.error('Error finding next job:', error);
        return false;
    }
}

async function applyToJobs() {
    try {
        console.log('Starting job applications...');
        while (isAutomating) {
            // Wait for page load
            await new Promise(r => setTimeout(r, 2000));
            
            // Check if already applied
            if (await isJobAlreadyApplied()) {
                console.log('Already applied to this job, moving to next...');
                if (!await findNextJob()) {
                    console.log('No more jobs available');
                    break;
                }
                continue;
            }

            // Find Easy Apply button and check if it's clickable
            const easyApplyBtn = document.querySelector('.jobs-apply-button:not([disabled])');
            if (!easyApplyBtn || !easyApplyBtn.textContent.toLowerCase().includes('easy apply')) {
                console.log('No Easy Apply button found or button disabled, moving to next job...');
                if (!await findNextJob()) {
                    console.log('No more jobs available');
                    break;
                }
                continue;
            }

            // Apply to current job
            console.log('Clicking Easy Apply button...');
            easyApplyBtn.click();
            await new Promise(r => setTimeout(r, 2000));

            const applied = await handleApplicationModal();
            if (applied) {
                jobsApplied++;
                console.log(`Successfully applied! Total: ${jobsApplied}`);
                chrome.runtime.sendMessage({ type: 'updateJobCount', count: jobsApplied });
                
                // Additional wait after successful application
                await new Promise(r => setTimeout(r, 1500));
            }

            // Move to next job
            if (!await findNextJob()) {
                console.log('No more jobs available');
                break;
            }

            // Wait between jobs
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (error) {
        console.error('Error in automation:', error);
    }
}

async function processApplicationSteps() {
    console.log("⏩ Processing application steps...");
    stepCounter = 0;
    consecutiveEmptySteps = 0;
    
    try {
        while (isAutomating && stepCounter < maxSteps) {
            await handleFormFields();
            await delay(1000);
            
            // Check for success message
            const modalContent = document.querySelector('.artdeco-modal__content');
            if (modalContent?.textContent.toLowerCase().includes('application submitted') ||
                modalContent?.textContent.toLowerCase().includes('applied')) {
                console.log("🎉 Application successful!");
                const doneButton = document.querySelector('button[aria-label="Dismiss"], button[aria-label="Done"]');
                if (doneButton) {
                    doneButton.click();
                    await delay(1000);
                }
                return true;
            }

            // Look for buttons in order of priority
            const submitButton = document.querySelector('button[aria-label="Submit application"]');
            const nextButton = document.querySelector('button[aria-label="Continue to next step"]');
            const reviewButton = document.querySelector('button[aria-label="Review your application"]');
            
            if (submitButton) {
                console.log("Found Submit button, clicking...");
                submitButton.click();
                await delay(2000);
                return true;
            } else if (nextButton) {
                console.log("Found Next button, clicking...");
                nextButton.click();
                await delay(1500);
            } else if (reviewButton) {
                console.log("Found Review button, clicking...");
                reviewButton.click();
                await delay(1500);
            } else {
                console.log("No action buttons found");
                consecutiveEmptySteps++;
                if (consecutiveEmptySteps >= 3) {
                    return false;
                }
            }
            
            stepCounter++;
            await delay(1500);
        }
        return false;
    } catch (error) {
        console.error("Error in application steps:", error);
        return false;
    }
}

function createApplyButton() {
    if (document.getElementById('linkedinAutoApplyFab')) return;
    
    fab = document.createElement('button');
    fab.id = 'linkedinAutoApplyFab';
    fab.innerHTML = `
        <span class="fab-icon">▶</span>
        <span class="fab-text">Auto Apply</span>
    `;
    
    // Style the button
    const style = {
        position: 'fixed',
        right: '20px',
        top: '100px',
        zIndex: '9999',
        padding: '12px 20px',
        background: 'linear-gradient(135deg, #0077b5, #0a66c2)',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'all 0.3s ease'
    };
    
    Object.assign(fab.style, style);
    
    // Add hover effect
    fab.onmouseover = () => {
        fab.style.transform = 'translateY(-2px)';
        fab.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
    };
    fab.onmouseout = () => {
        fab.style.transform = 'translateY(0)';
        fab.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    };
    
    // Add click handler
    fab.addEventListener('click', () => {
        if (!isAutomating) {
            isAutomating = true;
            jobsApplied = 0;
            fab.innerHTML = `
                <span class="fab-icon">⏹</span>
                <span class="fab-text">Stop</span>
            `;
            fab.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
            applyToJobs();
        } else {
            isAutomating = false;
            fab.innerHTML = `
                <span class="fab-icon">▶</span>
                <span class="fab-text">Auto Apply</span>
            `;
            fab.style.background = 'linear-gradient(135deg, #0077b5, #0a66c2)';
        }
    });
    
    document.body.appendChild(fab);
}

// Add this to initialize the button
window.addEventListener('load', () => {
    if (window.location.href.includes('linkedin.com/jobs')) {
        createApplyButton();
    }
});

// Also listen for URL changes to add button on job searches
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (location.href.includes('linkedin.com/jobs')) {
            createApplyButton();
        }
    }
}).observe(document, { subtree: true, childList: true });
