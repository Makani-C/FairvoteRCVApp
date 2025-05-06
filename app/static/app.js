// Configuration
const API_BASE_URL = "http://localhost:8000";

// DOM elements
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');
const loading = document.getElementById('loading');
const pollsList = document.getElementById('polls-list');

// Current state
let currentPollId = null;
let currentPoll = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Set up navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.getAttribute('data-page');
            navigateTo(targetPage);
        });
    });

    // Set up create poll form
    const createPollForm = document.getElementById('create-poll-form');
    createPollForm.addEventListener('submit', handleCreatePoll);

    // Set up option management
    const addOptionBtn = document.getElementById('add-option');
    addOptionBtn.addEventListener('click', addOptionInput);

    // Set up event delegation for remove option buttons
    document.getElementById('options-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-option')) {
            removeOptionInput(e.target.parentElement);
        }
    });

    // Set up poll detail page buttons
    document.getElementById('vote-button').addEventListener('click', () => {
        navigateTo('voting', currentPollId);
    });

    document.getElementById('results-button').addEventListener('click', () => {
        navigateTo('results', currentPollId);
    });

    // Set up results page back button
    document.getElementById('back-to-poll').addEventListener('click', () => {
        navigateTo('poll-detail', currentPollId);
    });

    // Initialize page based on URL hash or default to polls
    const hash = window.location.hash.substring(1);
    if (hash) {
        const [page, id] = hash.split('/');
        navigateTo(page, id);
    } else {
        navigateTo('polls');
    }
});

// Navigation function
function navigateTo(page, id = null) {
    // Hide all pages
    pages.forEach(p => p.classList.add('hidden'));

    // Update hash for back button support
    if (id) {
        window.location.hash = `${page}/${id}`;
    } else {
        window.location.hash = page;
    }

    // Show loading indicator
    loading.classList.remove('hidden');

    // Load appropriate page
    switch(page) {
        case 'polls':
            loadPolls();
            document.getElementById('polls-page').classList.remove('hidden');
            break;

        case 'create-poll':
            document.getElementById('create-poll-page').classList.remove('hidden');
            loading.classList.add('hidden');
            break;

        case 'poll-detail':
            loadPollDetail(id);
            document.getElementById('poll-detail-page').classList.remove('hidden');
            break;

        case 'voting':
            loadVotingForm(id);
            document.getElementById('voting-page').classList.remove('hidden');
            break;

        case 'results':
            loadResults(id);
            document.getElementById('results-page').classList.remove('hidden');
            break;

        default:
            console.error('Unknown page:', page);
            navigateTo('polls');
    }
}

// API Functions
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

        // Not OK response - attempt to parse error details from response
        if (!response.ok) {
            // Try to get detailed error message from response body
            let errorMessage = `API error: ${response.status}`;
            try {
                // Attempt to parse response as JSON to get detailed error
                const errorData = await response.json();

                // Check different possible error formats
                if (errorData.detail) {
                    errorMessage = errorData.detail;
                } else if (errorData.message) {
                    errorMessage = errorData.message;
                } else if (errorData.error) {
                    errorMessage = typeof errorData.error === 'string' ?
                        errorData.error : JSON.stringify(errorData.error);
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                } else {
                    // If we have a complex object, stringify it
                    errorMessage = `Error ${response.status}: ${JSON.stringify(errorData)}`;
                }
            } catch (parseError) {
                // If we can't parse JSON, use status text
                errorMessage = `Error ${response.status}: ${response.statusText || 'Unknown error'}`;
            }

            throw new Error(errorMessage);
        }

        // Check if response is empty (for DELETE requests)
        if (response.status === 204) {
            return true;
        }

        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);

        // Display error in popup with formatted message
        const errorMessage = error.message || 'Unknown error occurred';
        showPopup(errorMessage, 'Error', 'error');

        return null;
    } finally {
        loading.classList.add('hidden');
    }
}

// Page Loading Functions
async function loadPolls() {
    const polls = await fetchAPI('/polls/');

    if (polls) {
        pollsList.innerHTML = '';

        if (polls.length === 0) {
            pollsList.innerHTML = '<p>No polls available. Create your first poll!</p>';
            return;
        }

        polls.forEach(poll => {
            const pollCard = document.createElement('div');
            pollCard.className = 'poll-card';
            pollCard.innerHTML = `
                <h3>${escapeHTML(poll.title)}</h3>
                <p>${escapeHTML(poll.description || 'No description')}</p>
                <p><small>Created: ${new Date(poll.created_at).toLocaleDateString()}</small></p>
            `;

            pollCard.addEventListener('click', () => {
                navigateTo('poll-detail', poll.id);
            });

            pollsList.appendChild(pollCard);
        });
    }
}

async function loadPollDetail(id) {
    currentPollId = id;
    currentPoll = await fetchAPI(`/polls/${id}`);

    if (currentPoll) {
        document.getElementById('poll-detail-title').textContent = currentPoll.title;
        document.getElementById('poll-detail-description').textContent =
            currentPoll.description || 'No description provided.';
    }
}

async function loadVotingForm(id) {
    currentPollId = id;

    if (!currentPoll || currentPoll.id != id) {
        currentPoll = await fetchAPI(`/polls/${id}`);
    }

    if (currentPoll) {
        document.getElementById('voting-poll-title').textContent = currentPoll.title;
        document.getElementById('voting-poll-description').textContent =
            currentPoll.description || 'No description provided.';

        // Clear any existing options
        const optionsContainer = document.getElementById('numeric-ranking-options');
        optionsContainer.innerHTML = '';

        // Create the ranking interface for each option
        currentPoll.options.forEach((option) => {
            const optionRow = document.createElement('div');
            optionRow.className = 'option-rank-row';

            // Store the option ID correctly
            // Depending on your API, option might be an object with id and text properties
            // or it might be just a string. Let's handle both cases:
            if (typeof option === 'object' && option.id) {
                optionRow.dataset.optionId = option.id;
                optionRow.dataset.optionText = option.text;
            } else {
                optionRow.dataset.optionId = option;
                optionRow.dataset.optionText = option;
            }

            // Create the option text
            const optionText = document.createElement('div');
            optionText.className = 'option-text';
            // Display the option text properly
            optionText.textContent = typeof option === 'object' ? option.text : option;
            optionRow.appendChild(optionText);

            // Create the ranking numbers container
            const rankNumbers = document.createElement('div');
            rankNumbers.className = 'rank-numbers';

            // Create buttons for each possible rank
            for (let i = 1; i <= currentPoll.options.length; i++) {
                const rankButton = document.createElement('button');
                rankButton.type = 'button';
                rankButton.className = 'rank-button';
                rankButton.textContent = i;
                rankButton.dataset.rank = i;

                // When a rank button is clicked
                rankButton.addEventListener('click', function() {
                    const wasSelected = this.classList.contains('selected');

                    // If this button was already selected, unselect it
                    if (wasSelected) {
                        this.classList.remove('selected');
                    } else {
                        // First, remove the selected rank from all other options to prevent duplicates
                        const allOptionRows = document.querySelectorAll('.option-rank-row');
                        const clickedRank = parseInt(this.dataset.rank);

                        // Unselect this rank from any other option
                        allOptionRows.forEach(row => {
                            if (row !== optionRow) {
                                const buttonWithSameRank = row.querySelector(`.rank-button[data-rank="${clickedRank}"]`);
                                if (buttonWithSameRank && buttonWithSameRank.classList.contains('selected')) {
                                    buttonWithSameRank.classList.remove('selected');
                                }
                            }
                        });

                        // Unselect any other rank that might be selected for this option
                        optionRow.querySelectorAll('.rank-button.selected').forEach(btn => {
                            if (btn !== this) {
                                btn.classList.remove('selected');
                            }
                        });

                        // Select this button
                        this.classList.add('selected');
                    }
                });

                rankNumbers.appendChild(rankButton);
            }

            optionRow.appendChild(rankNumbers);
            optionsContainer.appendChild(optionRow);
        });

        // Set up the form submission
        document.getElementById('voting-form').onsubmit = function(e) {
            e.preventDefault();
            handleSubmitVote();
        };
    }

    loading.classList.add('hidden');
}

async function loadResults(id) {
    currentPollId = id;

    if (!currentPoll || currentPoll.id != id) {
        currentPoll = await fetchAPI(`/polls/${id}`);
    }

    const resultsData = await fetchAPI(`/results/api/poll/${id}`);

    if (currentPoll && resultsData) {
        document.getElementById('results-poll-title').textContent = currentPoll.title;

        // Render the results visualization
        renderResultsVisualization(resultsData);
    }
}

// Form Handling Functions
async function handleCreatePoll(e) {
    e.preventDefault();

    const title = document.getElementById('poll-title').value;
    const description = document.getElementById('poll-description').value;
    const optionInputs = document.querySelectorAll('.poll-option');

    const options = Array.from(optionInputs)
        .map(input => input.value.trim())
        .filter(text => text !== '');

    if (options.length < 2) {
        showPopup('Please provide at least 2 options.', 'Error', 'error');
    }

    const pollData = {
        title,
        description,
        options
    };

    loading.classList.remove('hidden');

    const result = await fetchAPI('/polls/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(pollData)
    });

    if (result) {
       showPopup('Poll created successfully!', 'Success', 'success', () => {
            document.getElementById('create-poll-form').reset();
            navigateTo('poll-detail', result.id);
        });
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

async function handleSubmitVote() {
    const email = document.getElementById('voter-email').value;

    // Validate email
    if (!email || !isValidEmail(email)) {
        showPopup('Please enter a valid email address.', 'Error', 'error');
    }

    // Collect the rankings from all options that have a rank selected
    const rankings = [];
    const optionRows = document.querySelectorAll('.option-rank-row');

    optionRows.forEach(row => {
        const optionId = row.dataset.optionId;
        const selectedRankBtn = row.querySelector('.rank-button.selected');

        // Only include options that have been ranked (have a selected rank button)
        if (selectedRankBtn) {
            const rank = parseInt(selectedRankBtn.dataset.rank);
            rankings.push({
                option: optionId,
                rank: rank
            });
        }
        // Options without a selected rank button are not included
    });

    // Validate that at least one option is ranked
    if (rankings.length === 0) {
        showPopup('Please enter a valid email address.', 'Error', 'error');
    }

    // Create the vote data object in the format expected by your backend
    const voteData = {
        email,
        poll_id: currentPollId,
        rankings: {}
    };

    // Convert the rankings array to the format expected by your API
    rankings.forEach(item => {
        // Here we assume your backend expects a mapping of option IDs to rank values
        voteData.rankings[item.option] = item.rank;
    });

    loading.classList.remove('hidden');

    const result = await fetchAPI(`/votes/?poll_id=${currentPollId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(voteData)
    });

    if (result) {
        showPopup('Your vote has been recorded!', 'Success', 'success', () => {
            navigateTo('results', currentPollId);
        });
    }
}

// Helper Functions
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function addOptionInput() {
    const optionsContainer = document.getElementById('options-container');
    const optionInputs = optionsContainer.querySelectorAll('.option-input');

    // Show remove buttons if we're adding more than the minimum
    if (optionInputs.length >= 2) {
        optionInputs.forEach(input => {
            input.querySelector('.remove-option').classList.remove('hidden');
        });
    }

    const newOption = document.createElement('div');
    newOption.className = 'option-input';
    newOption.innerHTML = `
        <input type="text" class="poll-option" required>
        <button type="button" class="remove-option">×</button>
    `;

    optionsContainer.appendChild(newOption);
}

function removeOptionInput(optionElement) {
    const optionsContainer = document.getElementById('options-container');
    const optionInputs = optionsContainer.querySelectorAll('.option-input');

    // Prevent removing if we only have 2 options left
    if (optionInputs.length <= 2) {
        showPopup('A poll must have at least 2 options.', 'Information', 'info');
    }

    optionElement.remove();

    // Hide remove buttons if we're down to the minimum
    const remainingInputs = optionsContainer.querySelectorAll('.option-input');
    if (remainingInputs.length <= 2) {
        remainingInputs.forEach(input => {
            input.querySelector('.remove-option').classList.add('hidden');
        });
    }
}

function makeOptionsSortable() {
    const sortableList = document.getElementById('sortable-options');
    const items = sortableList.querySelectorAll('.ranking-item');

    let draggedItem = null;

    items.forEach(item => {
        // Make item draggable
        item.setAttribute('draggable', true);

        item.addEventListener('dragstart', function() {
            draggedItem = this;
            setTimeout(() => this.classList.add('dragging'), 0);
        });

        item.addEventListener('dragend', function() {
            this.classList.remove('dragging');
            draggedItem = null;

            // Update the ranking numbers
            updateRankingNumbers();
        });

        item.addEventListener('dragover', function(e) {
            e.preventDefault();
        });

        item.addEventListener('dragenter', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });

        item.addEventListener('dragleave', function() {
            this.classList.remove('drag-over');
        });

        item.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');

            if (draggedItem !== this) {
                // Determine whether to insert before or after based on the middle point
                const rect = this.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                if (e.clientY < midpoint) {
                    sortableList.insertBefore(draggedItem, this);
                } else {
                    sortableList.insertBefore(draggedItem, this.nextSibling);
                }
            }
        });
    });
}

function updateRankingNumbers() {
    const items = document.querySelectorAll('.ranking-item');
    items.forEach((item, index) => {
        const rankingNumber = item.querySelector('.ranking-number');
        rankingNumber.textContent = index + 1;
    });
}

/**
 * Renders the results visualization for a ranked choice vote
 * @param {Object} resultsData - The data from the API containing voting results
 */
function renderResultsVisualization(resultsData) {
    if (!resultsData) {
        console.error('No results data available');
        return;
    }

    // Check if rounds is available
    if (!resultsData.results || !resultsData.results.rounds) {
        console.error('No rounds data in results');
        return;
    }

    const rounds = resultsData.results.rounds;
    const round1Results = document.getElementById('round-1-results');
    const additionalRounds = document.getElementById('additional-rounds');

    // Clear previous results
    round1Results.innerHTML = '';
    additionalRounds.innerHTML = '';

    // Determine the maximum vote count for scaling
    let maxVotes = 0;
    rounds.forEach(round => {
        if (round.counts) {
            Object.values(round.counts).forEach(count => {
                if (count > maxVotes) maxVotes = count;
            });
        }
    });

    // Add CSS for winner and eliminated styles if not already in the styles.css
    if (!document.getElementById('rcv-result-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'rcv-result-styles';
        styleEl.textContent = `
            .result-bar-inner.eliminated {
                background-color: var(--danger-color);
                opacity: 0.8;
            }
            .result-bar-inner.winner {
                background-color: var(--success-color);
                font-weight: bold;
            }
        `;
        document.head.appendChild(styleEl);
    }

    // Render Round 1
    if (rounds.length > 0) {
        const round1 = rounds[0];

        if (!round1.counts) {
            round1Results.innerHTML = '<p>No vote data available</p>';
        } else {
            Object.keys(round1.counts).forEach(optionText => {
                const votes = round1.counts[optionText];
                const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;

                const isEliminated = round1.eliminated === optionText;
                const isWinner = round1.winner === optionText;

                const resultBar = document.createElement('div');
                resultBar.className = 'result-bar-container';

                let barClass = 'result-bar-inner';
                if (isEliminated) barClass += ' eliminated';
                if (isWinner) barClass += ' winner';

                resultBar.innerHTML = `
                    <div class="result-bar-label">
                        <span>${escapeHTML(optionText)}</span>
                        <span>${votes} vote${votes !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="result-bar-outer">
                        <div class="${barClass}" style="width: ${percentage}%;">
                            ${votes}${isWinner ? ' (Winner)' : ''}${isEliminated ? ' (Eliminated)' : ''}
                        </div>
                    </div>
                `;

                round1Results.appendChild(resultBar);
            });
        }
    }

    // Render additional rounds
    if (rounds.length > 1) {
        for (let i = 1; i < rounds.length; i++) {
            const round = rounds[i];
            const roundDiv = document.createElement('div');
            roundDiv.className = 'round-results';
            roundDiv.innerHTML = `<h3>Round ${i + 1}</h3>`;

            if (!round.counts) {
                roundDiv.innerHTML += '<p>No vote data available for this round</p>';
                additionalRounds.appendChild(roundDiv);
                continue;
            }

            Object.keys(round.counts).forEach(optionText => {
                const votes = round.counts[optionText];
                const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;

                const isEliminated = round.eliminated === optionText;
                const isWinner = round.winner === optionText;

                const resultBar = document.createElement('div');
                resultBar.className = 'result-bar-container';

                let barClass = 'result-bar-inner';
                if (isEliminated) barClass += ' eliminated';
                if (isWinner) barClass += ' winner';

                resultBar.innerHTML = `
                    <div class="result-bar-label">
                        <span>${escapeHTML(optionText)}</span>
                        <span>${votes} vote${votes !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="result-bar-outer">
                        <div class="${barClass}" style="width: ${percentage}%;">
                            ${votes}${isWinner ? ' (Winner)' : ''}${isEliminated ? ' (Eliminated)' : ''}
                        </div>
                    </div>
                `;

                roundDiv.appendChild(resultBar);
            });

            additionalRounds.appendChild(roundDiv);
        }
    }
}

/**
 * Shows a popup message
 * @param {string} message - The message to display
 * @param {string} title - The title of the popup
 * @param {string} type - The type of popup (success, error, info)
 * @param {Function} callback - Optional callback function to execute when popup is closed
 */
function showPopup(message, title = 'Message', type = 'info', callback = null) {
    const popupContainer = document.getElementById('popup-container');
    const popupTitle = document.getElementById('popup-title');
    const popupMessage = document.getElementById('popup-message');
    const popup = popupContainer.querySelector('.popup');

    // Set content
    popupTitle.textContent = title;
    popupMessage.textContent = message;

    // Remove existing type classes and add the new one
    popup.classList.remove('success', 'error', 'info');
    popup.classList.add(type);

    // Show the popup
    popupContainer.classList.remove('hidden');

    // Add active class after a small delay for animation
    setTimeout(() => {
        popupContainer.classList.add('active');
    }, 10);

    // Set up close handlers
    const closePopup = () => {
        popupContainer.classList.remove('active');
        setTimeout(() => {
            popupContainer.classList.add('hidden');
            if (callback && typeof callback === 'function') {
                callback();
            }
        }, 300); // Waiting for transition to complete
    };

    document.getElementById('popup-close').onclick = closePopup;
    document.getElementById('popup-ok').onclick = closePopup;

    // Close when clicking outside
    popupContainer.addEventListener('click', (e) => {
        if (e.target === popupContainer) {
            closePopup();
        }
    });
}

/**
 * Shows a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, info)
 * @param {number} duration - How long to show the toast in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // Create the toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Determine icon based on type
    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'info') icon = 'ℹ';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;

    // Add to container
    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('active');
    }, 10);

    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

const originalAlert = window.alert;
window.alert = function(message) {
    if (message.includes('success') || message.includes('created') || message.includes('recorded')) {
        showPopup(message, 'Success', 'success');
    } else {
        showPopup(message, 'Alert', 'info');
    }
};
