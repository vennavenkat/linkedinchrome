console.log('LinkedIn Easy Apply content script loaded');

let isAutomating = false;
let jobsApplied = 0;

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
        // Wait for job list and get all job cards
        await new Promise(r => setTimeout(r, 2000));
        const jobCards = Array.from(document.querySelectorAll('.job-card-container--clickable'));
        
        // Find current job and next job
        const currentJob = document.querySelector('.job-card-container--selected');
        const currentIndex = currentJob ? jobCards.indexOf(currentJob) : -1;
        const nextJob = jobCards[currentIndex + 1];

        if (nextJob) {
            nextJob.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await new Promise(r => setTimeout(r, 1000));
            nextJob.click();
            await new Promise(r => setTimeout(r, 2000));
            return true;
        }

        // If no next job, try next page
        const nextButton = document.querySelector('.artdeco-pagination__button--next:not([disabled])');
        if (nextButton) {
            nextButton.click();
            await new Promise(r => setTimeout(r, 3000));
            const firstJob = document.querySelector('.job-card-container--clickable');
            if (firstJob) {
                firstJob.click();
                await new Promise(r => setTimeout(r, 2000));
                return true;
            }
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
            // Wait for page to load
            await new Promise(r => setTimeout(r, 2000));
            
            // Find and click Easy Apply button
            const easyApplyBtn = document.querySelector('button.jobs-apply-button');
            if (easyApplyBtn && !easyApplyBtn.disabled && 
                easyApplyBtn.textContent.toLowerCase().includes('easy apply')) {
                
                console.log('Found Easy Apply button, clicking...');
                easyApplyBtn.click();
                await new Promise(r => setTimeout(r, 2000));
                
                const applied = await handleApplicationModal();
                if (applied) {
                    jobsApplied++;
                    console.log(`Applied successfully! Total: ${jobsApplied}`);
                    chrome.runtime.sendMessage({ type: 'updateJobCount', count: jobsApplied });
                }
                await new Promise(r => setTimeout(r, 1000));
            }

            // Move to next job
            if (!await findNextJob()) {
                console.log('No more jobs available');
                break;
            }
            
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (error) {
        console.error('Error in automation:', error);
    }
}
