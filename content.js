console.log('LinkedIn Easy Apply content script loaded');

// Update counter management
let isAutomating = false;
let jobsApplied = 0;

// Improved counter update function
async function updateAllCounters(count, incrementing = false) {
    try {
        if (incrementing) {
            jobsApplied++;
            count = jobsApplied;
        } else {
            jobsApplied = parseInt(count) || 0;
        }

        // Update UI button counter
        const counter = document.querySelector('.apply-count');
        if (counter) {
            counter.textContent = jobsApplied.toString();
        }

        // Store in storage and notify popup
        await Promise.all([
            chrome.storage.local.set({
                jobCount: jobsApplied,
                lastUpdate: Date.now()
            }),
            chrome.runtime.sendMessage({
                type: 'updateJobCount',
                count: jobsApplied,
                timestamp: Date.now()
            })
        ]);

        console.log('Counter updated:', jobsApplied);
    } catch (error) {
        console.error('Error updating counter:', error);
    }
}

// Add sync interval for counter
let lastSyncedCount = 0;
setInterval(async () => {
    if (jobsApplied !== lastSyncedCount) {
        lastSyncedCount = jobsApplied;
        await chrome.storage.local.set({ jobCount: jobsApplied });
        console.log('Counter synced:', jobsApplied);
    }
}, 1000);

// Create and add the button immediately
function addButton() {
    const button = document.createElement('button');
    button.innerHTML = `
        <div class="apply-button-content">
            <span class="apply-icon">⚡</span>
            <span class="apply-text">Auto Apply</span>
            <span class="apply-count">${jobsApplied}</span>
        </div>
    `;
    button.id = 'linkedinAutoApplyFab';
    
    const styles = {
        position: 'fixed',
        right: '20px',
        top: '100px',
        zIndex: '9999999',
        padding: '12px 24px',
        background: 'linear-gradient(135deg, #0077b5 0%, #0a66c2 100%)',
        color: 'white',
        border: 'none',
        borderRadius: '50px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    };
    
    Object.assign(button.style, styles);
    
    // Add CSS for inner elements
    const style = document.createElement('style');
    style.textContent = `
        .apply-button-content {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .apply-icon {
            font-size: 18px;
        }
        .apply-count {
            background: rgba(255,255,255,0.2);
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            min-width: 20px;
            text-align: center;
        }
        #linkedinAutoApplyFab:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.25);
            background: linear-gradient(135deg, #006097 0%, #004182 100%);
        }
        #linkedinAutoApplyFab:active {
            transform: translateY(0);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        #linkedinAutoApplyFab.running {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { box-shadow: 0 4px 15px rgba(220, 53, 69, 0.2); }
            50% { box-shadow: 0 4px 25px rgba(220, 53, 69, 0.4); }
            100% { box-shadow: 0 4px 15px rgba(220, 53, 69, 0.2); }
        }
    `;
    
    document.head.appendChild(style);
    
    button.addEventListener('click', () => {
        if (!isAutomating) {
            isAutomating = true;
            button.classList.add('running');
            button.querySelector('.apply-text').textContent = 'Stop';
            applyToJobs();
        } else {
            isAutomating = false;
            button.classList.remove('running');
            button.querySelector('.apply-text').textContent = 'Auto Apply';
        }
    });
    
    document.body.appendChild(button);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addButton);
} else {
    addButton();
}

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
        const formTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Form fill timeout')), 20000)
        );

        const fillForm = async () => {
            // Enhanced dropdown handling - check ALL selects first
            const allSelects = document.querySelectorAll('select');
            console.log(`Found ${allSelects.length} dropdowns to process`);
            
            for (const select of allSelects) {
                if (select.options.length > 1) {
                    const labelText = (
                        select.labels?.[0]?.textContent ||
                        select.closest('fieldset')?.querySelector('legend')?.textContent ||
                        select.getAttribute('aria-label') ||
                        select.getAttribute('id') ||
                        select.getAttribute('name') ||
                        ''
                    ).toLowerCase();

                    console.log(`Processing dropdown: ${labelText}`);

                    // Handle email dropdown specifically
                    if (labelText.includes('email') || select.id?.toLowerCase().includes('email')) {
                        console.log('Found email dropdown');
                        const options = Array.from(select.options);
                        const emailOption = options.find(opt => 
                            opt.text.toLowerCase().includes('venkatkumarvenna99@gmail.com') ||
                            opt.value.toLowerCase().includes('venkatkumarvenna99@gmail.com')
                        );
                        
                        if (emailOption) {
                            select.value = emailOption.value;
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                            select.dispatchEvent(new Event('input', { bubbles: true }));
                            await new Promise(r => setTimeout(r, 100));
                            continue;
                        }
                    }

                    // Create array of valid options (exclude empty/placeholder options)
                    const validOptions = Array.from(select.options)
                        .filter(opt => opt.value && opt.text.trim() && 
                               !opt.text.toLowerCase().includes('select') &&
                               !opt.text.toLowerCase().includes('choose'));

                    if (validOptions.length > 0) {
                        let selectedOption;

                        // Check for negative patterns
                        if (labelText.match(/citizen|sponsor|visa|work.*(auth|eligible)|immigration/i)) {
                            selectedOption = validOptions.find(opt => 
                                opt.text.toLowerCase().match(/no|not|none|decline|disagree/i)
                            );
                        } 
                        // Check for positive patterns
                        else {
                            selectedOption = validOptions.find(opt => 
                                opt.text.toLowerCase().match(/yes|agree|accept|can|able|will|do|have/i)
                            );
                        }

                        // Fallback handling
                        if (!selectedOption) {
                            if (validOptions.length > 1) {
                                selectedOption = validOptions[1]; // Take second option if available
                            } else {
                                selectedOption = validOptions[0]; // Take first valid option
                            }
                        }

                        if (selectedOption) {
                            console.log(`Selected "${selectedOption.text}" for dropdown: ${labelText}`);
                            select.value = selectedOption.value;
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                            select.dispatchEvent(new Event('input', { bubbles: true }));
                            await new Promise(r => setTimeout(r, 100));
                        }
                    }
                }
            }

            // Handle specific form elements by ID
            const specificFormElement = document.querySelector('[id*="text-entity-list-form-component-formElement-urn-li-jobs-applyformcommon-easyApplyFormElement"]');
            if (specificFormElement) {
                const selectElements = specificFormElement.querySelectorAll('select');
                for (const select of selectElements) {
                    // Find and select "Yes" option
                    const options = Array.from(select.options);
                    const yesOption = options.find(opt => 
                        opt.text.toLowerCase().includes('yes') ||
                        opt.value.toLowerCase().includes('yes')
                    );
                    if (yesOption) {
                        select.value = yesOption.value;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 50));
                    }
                }
            }

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
                
                // Updated checkbox handling
                if (input.type === 'checkbox') {
                    const labelText = (
                        fieldName || 
                        input.parentElement?.textContent?.toLowerCase() || 
                        input.closest('label')?.textContent?.toLowerCase() ||
                        input.closest('fieldset')?.querySelector('legend')?.textContent?.toLowerCase() ||
                        ''
                    ).trim();

                    console.log('Processing checkbox:', labelText);

                    // More specific pattern matching for unchecking
                    const shouldUncheck = (
                        /\btop choice\b/i.test(labelText) ||
                        /\bfollow\b.*\bcompany\b/i.test(labelText) ||
                        /\bfollow\b.*\borganization\b/i.test(labelText) ||
                        /\bmark\b.*\btop\b/i.test(labelText) ||
                        /\bjob\s+alert/i.test(labelText) ||
                        /receive.*message/i.test(labelText) ||
                        /\bconnect\b/i.test(labelText) ||
                        /\bnewsletter\b/i.test(labelText) ||
                        /\bsubscribe\b/i.test(labelText) ||
                        /\bnotification\b/i.test(labelText)
                    );

                    console.log(`Checkbox "${labelText}" should be ${shouldUncheck ? 'unchecked' : 'checked'}`);
                    
                    // Set checkbox state and dispatch events
                    if (input.checked !== !shouldUncheck) {
                        input.checked = !shouldUncheck;
                        input.click(); // Ensure UI updates
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 50));
                    }
                    continue;
                }

                let valueSet = false;
    
                // Improved email field detection
                if (fieldName.includes('email') || 
                    input.type === 'email' || 
                    input.getAttribute('type') === 'email' ||
                    input.id?.toLowerCase().includes('email') ||
                    input.name?.toLowerCase().includes('email')) {
                    await fillInput(input, 'venkatkumarvenna99@gmail.com');
                    valueSet = true;
                    console.log('Filled email field:', fieldName);
                } else if ((fieldName.includes('agreement') || fieldName.includes('terms'))) {
                    await fillInput(input, 'no');
                    valueSet = true;
                } else if (fieldName.includes('disability') || fieldName.includes('veteran')) {
                    await fillInput(input, 'no');
                    valueSet = true;
                } else if ((fieldName.includes('full') && fieldName.includes('name'))) {
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
                if (!valueSet && input.required && input.value === '') {
                    console.log('Using fallback value 5 for field:', fieldName);
                    await fillInput(input, '5');
                }
            }
    
            // Handle radio buttons and questions with updated citizenship check
            const questions = document.querySelectorAll('fieldset, .jobs-easy-apply-form-section, .jobs-easy-apply-form-element');
            for (const question of questions) {
                const questionText = (
                    question.querySelector('legend')?.textContent ||
                    question.querySelector('label')?.textContent ||
                    question.textContent ||
                    ''
                ).toLowerCase();
    
                console.log('Processing question:', questionText);
    
                // Updated logic to select YES for work authorization
                if (questionText.includes('work authorization') ||
                    questionText.includes('legally authorized') ||
                    questionText.includes('right to work') ||
                    questionText.includes('legal right')) {
                    await selectRadioOption(question, 'yes');
                } else if (questionText.includes('citizen') || 
                          questionText.includes('citizenship') || 
                          questionText.includes('sponsorship') || 
                          questionText.includes('visa') ||
                          questionText.includes('immigration')) {
                    await selectRadioOption(question, 'no');
                } else if (questionText.includes('agreement') || questionText.includes('terms')) {
                    await selectRadioOption(question, 'no');
                } else if (questionText.includes('disability') || questionText.includes('veteran')) {
                    await selectRadioOption(question, 'no');
                } else {
                    await selectRadioOption(question, 'yes');
                }
            }
    
            // Update dropdown handling for work authorization
            const selects = document.querySelectorAll('select:not([value])');
            for (const select of selects) {
                if (!select.value && select.options.length > 1) {
                    const labelText = (
                        select.labels?.[0]?.textContent ||
                        select.closest('fieldset')?.querySelector('legend')?.textContent ||
                        select.getAttribute('aria-label') ||
                        ''
                    ).toLowerCase();
    
                    if (labelText.includes('work authorization') ||
                        labelText.includes('legally authorized') ||
                        labelText.includes('right to work')) {
                        await handleSelectWithPreference(select, 'yes');
                    } else if (labelText.includes('citizen') || 
                        labelText.includes('citizenship') ||
                        labelText.includes('sponsorship') ||
                        labelText.includes('visa')) {
                        await handleSelectWithPreference(select, 'no');
                    } else {
                        // ...rest of existing select handling...
                        let selectedIndex = 1; // Default to first non-empty option
                        const options = Array.from(select.options);
                        
                        if (labelText.includes('disability') || labelText.includes('veteran') || 
                            labelText.includes('sponsorship') || labelText.includes('visa')) {
                            // Look for "No" option
                            const noIndex = options.findIndex(opt => 
                                opt.text.toLowerCase().includes('no') ||
                                opt.text.toLowerCase().includes('decline') ||
                                opt.text.toLowerCase().includes('not')
                            );
                            if (noIndex > 0) selectedIndex = noIndex;
                        } else {
                            // For all other dropdowns, prefer "Yes" option
                            const yesIndex = options.findIndex(opt => 
                                opt.text.toLowerCase().includes('yes') ||
                                opt.text.toLowerCase().includes('agree')
                            );
                            if (yesIndex > 0) selectedIndex = yesIndex;
                        }
        
                        select.selectedIndex = selectedIndex;
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 50));
                    }
                }
            }
        };

        await Promise.race([formTimeout, fillForm()]);
    } catch (error) {
        console.error('Error or timeout in form filling:', error);
        // Force continue to next job on timeout
        return false;
    }
}

// Replace the existing handleSelectWithPreference with this simpler version
async function handleSelectWithPreference(select, preference) {
    const validOptions = Array.from(select.options)
        .filter(opt => opt.value && opt.text.trim());
    
    if (validOptions.length === 0) return;

    let selectedOption;
    if (preference === 'no') {
        selectedOption = validOptions.find(opt => 
            opt.text.toLowerCase().match(/no|not|none|decline|disagree/i)
        );
    } else {
        selectedOption = validOptions.find(opt => 
            opt.text.toLowerCase().match(/yes|agree|accept|can|able|will|do|have/i)
        );
    }

    if (!selectedOption && validOptions.length > 1) {
        selectedOption = validOptions[1];
    } else if (!selectedOption) {
        selectedOption = validOptions[0];
    }

    if (selectedOption) {
        select.value = selectedOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        select.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
    }
}

async function fillInput(input, value) {
    try {
        input.focus();
        await new Promise(r => setTimeout(r, 100));
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        await new Promise(r => setTimeout(r, 100));
    } catch (error) {
        console.error('Error filling input:', error);
    }
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
        const modal = await waitForElement('.jobs-easy-apply-modal', 5000); // Increased timeout
        if (!modal) {
            console.log('Modal not found, skipping...');
            return false;
        }

        let startTime = Date.now();
        let submitAttempts = 0;
        let stepAttempts = 0;
        const maxStepAttempts = 10;
        const maxSubmitAttempts = 3;

        while (isAutomating && stepAttempts < maxStepAttempts) {
            try {
                // Check for timeout
                if (Date.now() - startTime > 40000) { // Increased timeout
                    console.log('Application taking too long, skipping...');
                    await safelyDismissModal();
                    return false;
                }

                // Wait for form to be interactive
                await new Promise(r => setTimeout(r, 1000));
                
                // Handle form fields
                await handleFormFields().catch(console.error);
                await new Promise(r => setTimeout(r, 1000));
                
                // Find all possible buttons
                const buttons = {
                    submit: modal.querySelector('button[aria-label="Submit application"]:not([disabled])'),
                    next: modal.querySelector('button[aria-label="Continue to next step"]:not([disabled])'),
                    review: modal.querySelector('button[aria-label="Review your application"]:not([disabled])'),
                    done: modal.querySelector('button[aria-label="Done"]:not([disabled])') ||
                          modal.querySelector('button[aria-label="Dismiss"]:not([disabled])')
                };

                // Check for success message and handle counter update
                const successMessage = modal.textContent.toLowerCase().includes('applied') ||
                                    modal.textContent.toLowerCase().includes('application submitted');

                if (successMessage && buttons.done) {
                    console.log('Application successful!');
                    jobsApplied++;
                    lastSyncedCount = jobsApplied;
                    
                    // Immediately update storage and UI
                    await Promise.all([
                        chrome.storage.local.set({ jobCount: jobsApplied }),
                        chrome.runtime.sendMessage({
                            type: 'updateJobCount',
                            count: jobsApplied,
                            timestamp: Date.now()
                        })
                    ]);
                    
                    // Update UI button counter
                    const counter = document.querySelector('.apply-count');
                    if (counter) {
                        counter.textContent = jobsApplied.toString();
                    }
                    
                    console.log('Updated job count:', jobsApplied);
                    await new Promise(r => setTimeout(r, 1000));
                    buttons.done.click();
                    return true;
                }

                // Handle submit button
                if (buttons.submit) {
                    console.log('Submitting application...');
                    buttons.submit.click();
                    submitAttempts++;
                    await new Promise(r => setTimeout(r, 2000));
                    
                    // Check if submission was successful
                    if (submitAttempts >= maxSubmitAttempts) {
                        console.log('Max submit attempts reached');
                        await safelyDismissModal();
                        return false;
                    }
                    continue;
                }

                // Handle review button
                if (buttons.review) {
                    console.log('Reviewing application...');
                    buttons.review.click();
                    await new Promise(r => setTimeout(r, 1500));
                    continue;
                }

                // Handle next button
                if (buttons.next) {
                    console.log('Moving to next step...');
                    buttons.next.click();
                    await new Promise(r => setTimeout(r, 1500));
                    continue;
                }

                // If no buttons found
                stepAttempts++;
                await new Promise(r => setTimeout(r, 1000));

            } catch (error) {
                console.error('Error in application step:', error);
                stepAttempts++;
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // If we reach here, something went wrong
        console.log('Application process failed or timed out');
        await safelyDismissModal();
        return false;

    } catch (error) {
        console.error('Error in application modal:', error);
        await safelyDismissModal();
        return false;
    }
}

// Add helper function for safely dismissing modal
async function safelyDismissModal() {
    try {
        const dismissButton = document.querySelector('button[aria-label="Dismiss"]');
        if (dismissButton) {
            await new Promise(r => setTimeout(r, 500));
            dismissButton.click();
        }
    } catch (error) {
        console.error('Error dismissing modal:', error);
    }
}

// Add helper function for updating job counter
function updateJobCounter(count) {
    const counter = document.querySelector('.apply-count');
    if (counter) {
        counter.textContent = count;
    }
    chrome.runtime.sendMessage({ type: 'updateJobCount', count });
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

// Update the blocked companies and keywords lists
const BLOCKED_COMPANIES = [
    'compunnel',
    'compunnel inc',
    'compunnel software',
    'compunnelsoftware',
    'compunnel software group',
    'compunnel staffing',
    'ptr',
    'ptr global',
    'ptr solutions',
    'ptrglobal'
].map(name => name.toLowerCase());

const BLOCKED_TITLE_KEYWORDS = [
    'clearance',
    'security clearance',
    'secret clearance',
    'cleared',
    'top secret',
    'ts/sci',
    'public trust',
    'ts clearance',
    'government clearance',
    'active clearance',
    'security requirements',
    'requires clearance',
    'must be cleared',
    'clearance required',
    'security credentials'
].map(keyword => keyword.toLowerCase());

// Enhanced job filtering function
async function shouldSkipJob() {
    try {
        // Wait for job details to load
        await new Promise(r => setTimeout(r, 1000));

        // Check company name using the correct class selector
        const companySelectors = [
            '.lqQJrmhxpqvSKJwiwrWHrYYjevPYYtO', // LinkedIn's dynamic class for company name
            '.jobs-unified-top-card__company-name',
            '.jobs-company__name',
            '[data-tracking-control-name="public_jobs_topcard-company-name"]',
            '.jobs-details-top-card__company-url',
            '.job-card-container__company-name'
        ];

        for (const selector of companySelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                const companyName = element.textContent.trim().toLowerCase();
                console.log('Checking company:', companyName);
                if (BLOCKED_COMPANIES.some(name => companyName.includes(name))) {
                    console.log('Blocked company found:', companyName);
                    return true;
                }
            }
        }

        // Check job title using multiple selectors
        const titleSelectors = [
            '.jobs-unified-top-card__job-title',
            '.jobs-details-top-card__job-title',
            '[data-tracking-control-name="public_jobs_topcard-title"]',
            '.job-card-list__title'
        ];

        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const jobTitle = element.textContent.trim().toLowerCase();
                console.log('Checking job title:', jobTitle);
                if (BLOCKED_TITLE_KEYWORDS.some(keyword => jobTitle.includes(keyword))) {
                    console.log('Blocked keyword found in title:', jobTitle);
                    return true;
                }
            }
        }

        // Check job description
        const descriptionSelectors = [
            '.jobs-description',
            '.jobs-description-content__text',
            '[data-tracking-control-name="public_jobs_description"]',
            '.job-view-layout'
        ];

        for (const selector of descriptionSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const description = element.textContent.trim().toLowerCase();
                if (BLOCKED_TITLE_KEYWORDS.some(keyword => description.includes(keyword))) {
                    console.log('Blocked keyword found in description');
                    return true;
                }
            }
        }

        return false;
    } catch (error) {
        console.error('Error in job filtering:', error);
        return false;
    }
}

// Update the applyToJobs function
async function applyToJobs() {
    try {
        while (isAutomating) {
            // Wait for job details to load properly
            await new Promise(r => setTimeout(r, 2000));
            
            // Check if we should skip this job
            if (await shouldSkipJob()) {
                console.log('Skipping blocked job...');
                const nextJob = await findNextJob();
                if (!nextJob) break;
                continue;
            }

            // Find and click Easy Apply button
            const easyApplyBtn = document.querySelector('button.jobs-apply-button');
            if (easyApplyBtn && easyApplyBtn.innerText.includes('Easy Apply')) {
                easyApplyBtn.click();
                await new Promise(r => setTimeout(r, 1000));
                
                // Handle the application form
                const applied = await handleApplicationModal();
                if (applied) {
                    console.log(`Successfully applied! Total: ${jobsApplied}`);
                    // Update button counter if it exists
                    const counter = document.querySelector('.apply-count');
                    if (counter) {
                        counter.textContent = jobsApplied;
                    }
                }
            }

            // Find next job
            const nextJob = await findNextJob();
            if (!nextJob) break;
            
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (error) {
        console.error('Error:', error);
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

// Update button handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startApply') {
        console.log('Received start command');
        if (!isAutomating) {
            isAutomating = true;
            const button = document.getElementById('linkedinAutoApplyFab');
            if (button) {
                button.classList.add('running');
                button.querySelector('.apply-text').textContent = 'Stop';
            }
            applyToJobs();
        }
    } else if (message.action === 'stopApply') {
        console.log('Received stop command');
        isAutomating = false;
        const button = document.getElementById('linkedinAutoApplyFab');
        if (button) {
            button.classList.remove('running');
            button.querySelector('.apply-text').textContent = 'Auto Apply';
        }
    }
});

// Update the initialization function
async function initializeCounter() {
    try {
        const result = await chrome.storage.local.get(['jobCount']);
        const savedCount = parseInt(result.jobCount) || 0;
        console.log('Loaded saved count:', savedCount);
        await updateAllCounters(savedCount);
    } catch (error) {
        console.error('Error loading counter:', error);
    }
}

// Call initialize when script loads
document.addEventListener('DOMContentLoaded', initializeCounter);
window.addEventListener('load', initializeCounter);
