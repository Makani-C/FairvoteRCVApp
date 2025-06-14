// Configuration
const API_BASE_URL = window.location.origin;

// DOM elements
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');
const loading = document.getElementById('loading');
const pollsList = document.getElementById('polls-list');

// Current state
let currentPollId = null;
let currentPoll = null;
let isAdmin = false;
let adminToken = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Check for admin session
    adminToken = localStorage.getItem('adminToken');
    isAdmin = !!adminToken;

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

    // Set up admin login form
    document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);

    // Set up admin tabs
    document.querySelectorAll('.admin-tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            document.querySelectorAll('.admin-tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));

            // Add active class to clicked tab
            tab.classList.add('active');

            // Show corresponding content
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.remove('hidden');

            // Load content based on tab
            if (tabId === 'manage-polls') {
                loadAdminPolls();
            } else if (tabId === 'view-voters') {
                loadPollsForVotersDropdown();
                document.getElementById('voters-list').innerHTML = '<p>Please select a poll to view voters.</p>';
            }
        });
    });

    // Set up poll selection for voters
    document.getElementById('select-poll-for-voters').addEventListener('change', function() {
        const pollId = this.value;
        if (pollId) {
            loadVotersForPoll(pollId);
        } else {
            document.getElementById('voters-list').innerHTML = '<p>Please select a poll to view voters.</p>';
        }
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

    // Check admin routes protection
    if (page.startsWith('admin') && page !== 'admin-login' && !isAdmin) {
        showPopup('You need to login as admin first.', 'Access Denied', 'error', () => {
            navigateTo('admin-login');
        });
        return;
    }

    if (page !== 'results' && currentPollId) {
        localStorage.removeItem(`just_voted_${currentPollId}`);
    }

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

        case 'admin-login':
            document.getElementById('admin-login-page').classList.remove('hidden');
            loading.classList.add('hidden');
            break;

        case 'admin-dashboard':
            loadAdminPolls();
            document.getElementById('admin-dashboard-page').classList.remove('hidden');
            break;

        default:
            console.error('Unknown page:', page);
            navigateTo('polls');
    }
}

// API Functions
async function fetchAPI(endpoint, options = {}) {
    try {
        // Add auth token for admin endpoints if available
        if (adminToken && !options.headers) {
            options.headers = {
                'Authorization': `Bearer ${adminToken}`
            };
        } else if (adminToken && options.headers) {
            options.headers['Authorization'] = `Bearer ${adminToken}`;
        }

        if (options.method === 'POST' || options.method === 'PUT') {
            if (!options.headers) {
                options.headers = {};
            }
            if (!options.headers['Content-Type']) {
                options.headers['Content-Type'] = 'application/json';
            }
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

        // Not OK response - attempt to parse error details from response
        if (!response.ok) {
            // Handle unauthorized access
            if (response.status === 401 || response.status === 403) {
                isAdmin = false;
                localStorage.removeItem('adminToken');

                if (window.location.hash.startsWith('#admin') && window.location.hash !== '#admin-login') {
                    showPopup('Your session has expired. Please login again.', 'Session Expired', 'error', () => {
                        navigateTo('admin-login');
                    });
                    throw new Error('Unauthorized access');
                }
            }

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

            // Display locked status if poll is locked
            let lockedStatus = '';
            if (poll.locked) {
                lockedStatus = '<span class="status-badge locked-badge">Locked</span>';
            }

            pollCard.innerHTML = `
                <h3>${escapeHTML(poll.title)} ${lockedStatus}</h3>
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

        // Show locked status if poll is locked
        const statusIndicator = document.getElementById('poll-status-indicator');
        if (currentPoll.locked) {
            statusIndicator.classList.remove('hidden');
            document.getElementById('vote-button').disabled = true;
            document.getElementById('vote-button').classList.add('disabled');
        } else {
            statusIndicator.classList.add('hidden');
            document.getElementById('vote-button').disabled = false;
            document.getElementById('vote-button').classList.remove('disabled');
        }
    }
}

async function loadVotingForm(id) {
    currentPollId = id;

    if (!currentPoll || currentPoll.id != id) {
        currentPoll = await fetchAPI(`/polls/${id}`);
    }

    if (currentPoll) {
        // Check if poll is locked
        if (currentPoll.locked) {
            showPopup('This poll is locked and no longer accepting votes.', 'Poll Locked', 'error', () => {
                navigateTo('poll-detail', id);
            });
            return;
        }

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
    
    let userVote = null;
    
    const justVoted = localStorage.getItem(`just_voted_${id}`) === 'true';
    
    if (justVoted) {
        const voterEmail = localStorage.getItem(`voter_${id}`);
        const voterRankings = localStorage.getItem(`voter_rankings_${id}`);
        
        if (voterEmail && voterRankings) {
            userVote = {
                email: voterEmail,
                rankings: JSON.parse(voterRankings)
            };
        }
        
        localStorage.removeItem(`just_voted_${id}`);
    }

    if (currentPoll && resultsData) {
        document.getElementById('results-poll-title').textContent = currentPoll.title;
        renderResultsVisualization(resultsData, userVote);
    }
}

// Admin Functions
async function handleAdminLogin(e) {
    e.preventDefault();


    loading.classList.remove('hidden');

    adminToken = 'demo-token-' + Date.now();
    localStorage.setItem('adminToken', adminToken);
    isAdmin = true;

    // Hide and clear the form
    loading.classList.add('hidden');
    document.getElementById('admin-login-form').reset();

    navigateTo('admin-dashboard');

    // const username = document.getElementById('admin-username').value;

    // if (username && username.trim() !== '') {
    //     // Set admin status and store in localStorage
    //     adminToken = 'demo-token-' + Date.now(); // Simple token for demo
    //     localStorage.setItem('adminToken', adminToken);
    //     isAdmin = true;

    //     // Hide and clear the form
    //     loading.classList.add('hidden');
    //     document.getElementById('admin-login-form').reset();

    //     navigateTo('admin-dashboard');
    // } else {
    //     // Hide loading and show error if username is empty
    //     loading.classList.add('hidden');
    //     showPopup('Please enter a username', 'Error', 'error');
    // }

    // TODO - require password
    // const result = await fetchAPI('/admin/login', {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify({ username })
    // });
    //
    // if (result && result.token) {
    //     adminToken = result.token;
    //     localStorage.setItem('adminToken', adminToken);
    //     isAdmin = true;
    //
    //     showPopup('Login successful!', 'Success', 'success', () => {
    //         navigateTo('admin-dashboard');
    //     });
    //
    //     // Clear the form
    //     document.getElementById('admin-login-form').reset();
    // }
}


async function loadAdminPolls() {
    if (!isAdmin) {
        navigateTo('admin-login');
        return;
    }

    const adminPollsList = document.getElementById('admin-polls-list');
    const polls = await fetchAPI('/polls/');

    if (polls) {
        adminPollsList.innerHTML = '';

        if (polls.length === 0) {
            adminPollsList.innerHTML = '<p>No polls available.</p>';
            return;
        }

        polls.forEach(poll => {
            const pollCard = document.createElement('div');
            pollCard.className = 'admin-poll-card';

            pollCard.innerHTML = `
                <div class="admin-poll-header">
                    <h3 class="admin-poll-title">${escapeHTML(poll.title)}</h3>
                    <div class="admin-poll-actions">
                        <button class="admin-action-btn ${poll.locked ? 'unlock' : 'lock'}" data-id="${poll.id}">
                            ${poll.locked ? 'Unlock' : 'Lock'}
                        </button>
                        <button class="admin-action-btn delete" data-id="${poll.id}">Delete</button>
                        <button class="admin-action-btn view-voters" data-id="${poll.id}">View Voters</button>
                    </div>
                </div>
                <p>${escapeHTML(poll.description || 'No description')}</p>
                <div class="admin-poll-meta">
                    <span>Status: <strong>${poll.locked ? 'Locked' : 'Open'}</strong></span>
                    <span>Created: ${new Date(poll.created_at).toLocaleDateString()}</span>
                    <span>Options: ${poll.options.length}</span>
                </div>
            `;

            // Add event listeners for the action buttons
            pollCard.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                confirmDeletePoll(poll.id, poll.title);
            });

            const lockButton = pollCard.querySelector('.lock, .unlock');
            lockButton.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePollLock(poll.id, poll.locked);
            });

            pollCard.querySelector('.view-voters').addEventListener('click', (e) => {
                e.stopPropagation();
                // Switch to voters tab and load data for this poll
                document.querySelector('.admin-tab-btn[data-tab="view-voters"]').click();
                document.getElementById('select-poll-for-voters').value = poll.id;
                loadVotersForPoll(poll.id);
            });

            adminPollsList.appendChild(pollCard);
        });
    }
}

async function loadPollsForVotersDropdown() {
    if (!isAdmin) {
        navigateTo('admin-login');
        return;
    }

    const selectPoll = document.getElementById('select-poll-for-voters');
    const polls = await fetchAPI('/polls/');

    if (polls) {
        // Clear existing options
        selectPoll.innerHTML = '<option value="">Select a poll</option>';

        polls.forEach(poll => {
            const option = document.createElement('option');
            option.value = poll.id;
            option.textContent = poll.title;
            selectPoll.appendChild(option);
        });
    }
}

async function loadVotersForPoll(pollId) {
    if (!isAdmin) {
        navigateTo('admin-login');
        return;
    }

    const votersList = document.getElementById('voters-list');
    votersList.innerHTML = '<p>Loading voters...</p>';

    const votes = await fetchAPI(`/votes/poll/${pollId}`);

    if (votes) {
        if (votes.length === 0) {
            votersList.innerHTML = '<p>No votes have been cast for this poll yet.</p>';
            return;
        }

        // Create table of voters
        const table = document.createElement('table');
        table.className = 'voters-table';

        // Create table header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Email</th>
                <th>Voted On</th>
                <th>Rankings</th>
                <th>Actions</th>
            </tr>
        `;
        table.appendChild(thead);

        // Create table body
        const tbody = document.createElement('tbody');

        votes.forEach(vote => {
            const tr = document.createElement('tr');

            // Format rankings as a readable string
            const rankingsStr = Object.entries(vote.rankings)
                .map(([optId, rank]) => `Option ${optId}: ${rank}`)
                .join(', ');

            tr.innerHTML = `
                <td>${escapeHTML(vote.email)}</td>
                <td>${new Date(vote.created_at).toLocaleString()}</td>
                <td>${escapeHTML(rankingsStr)}</td>
                <td>
                    <button class="delete-vote-btn" data-vote-id="${vote.id}">Delete</button>
                </td>
            `;

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        votersList.innerHTML = '';
        votersList.appendChild(table);

        document.querySelectorAll('.delete-vote-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                confirmDeleteVote(btn.getAttribute('data-vote-id'), pollId);
            });
        });
    }
}

async function deleteVote(voteId, pollId) {
    loading.classList.remove('hidden');

    const result = await fetchAPI(`/votes/${voteId}`, {
        method: 'DELETE'
    });

    if (result) {
        showPopup('Vote deleted successfully!', 'Success', 'success', () => {
            // Reload the voters list to reflect the deletion
            loadVotersForPoll(pollId);
        });
    }
}

function confirmDeleteVote(voteId, pollId) {
    const message = `Are you sure you want to delete this vote? This action cannot be undone.`;

    // Create a custom popup for confirmation
    const popupContainer = document.getElementById('popup-container');
    const popupTitle = document.getElementById('popup-title');
    const popupMessage = document.getElementById('popup-message');
    const popup = popupContainer.querySelector('.popup');
    const popupFooter = popup.querySelector('.popup-footer');

    // Save original footer content
    const originalFooter = popupFooter.innerHTML;

    // Set content
    popupTitle.textContent = 'Confirm Vote Deletion';
    popupMessage.textContent = message;

    // Change footer to include cancel and confirm buttons
    popupFooter.innerHTML = `
        <button id="popup-cancel" class="btn-secondary">Cancel</button>
        <button id="popup-confirm" class="btn-danger">Delete</button>
    `;

    // Add class for styling
    popup.classList.add('confirmation');

    // Show the popup
    popupContainer.classList.remove('hidden');
    setTimeout(() => {
        popupContainer.classList.add('active');
    }, 10);

    // Set up close handlers
    const closePopup = () => {
        popupContainer.classList.remove('active');
        setTimeout(() => {
            popupContainer.classList.add('hidden');

            // Restore original footer
            popupFooter.innerHTML = originalFooter;

            // Remove confirmation class
            popup.classList.remove('confirmation');
        }, 300);
    };

    document.getElementById('popup-close').onclick = closePopup;
    document.getElementById('popup-cancel').onclick = closePopup;

    // Set up confirm handler
    document.getElementById('popup-confirm').onclick = async () => {
        closePopup();
        await deleteVote(voteId, pollId);
    };

    // Close when clicking outside
    popupContainer.addEventListener('click', (e) => {
        if (e.target === popupContainer) {
            closePopup();
        }
    });
}

async function togglePollLock(pollId, currentStatus) {
    loading.classList.remove('hidden');

    const newStatus = !currentStatus;
    const statusLabel = newStatus ? 'locked' : 'unlocked';

    const result = await fetchAPI(`/polls/${pollId}/lock`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ locked: newStatus })
    });

    if (result) {
        showPopup(`Poll ${statusLabel} successfully!`, 'Success', 'success', () => {
            loadAdminPolls();
        });
    }
}

function confirmDeletePoll(pollId, pollTitle) {
    const message = `Are you sure you want to delete the poll "${pollTitle}"? This action cannot be undone.`;

    // Create a custom popup for confirmation
    const popupContainer = document.getElementById('popup-container');
    const popupTitle = document.getElementById('popup-title');
    const popupMessage = document.getElementById('popup-message');
    const popup = popupContainer.querySelector('.popup');
    const popupFooter = popup.querySelector('.popup-footer');

    // Save original footer content
    const originalFooter = popupFooter.innerHTML;

    // Set content
    popupTitle.textContent = 'Confirm Deletion';
    popupMessage.textContent = message;

    // Change footer to include cancel and confirm buttons
    popupFooter.innerHTML = `
        <button id="popup-cancel" class="btn-secondary">Cancel</button>
        <button id="popup-confirm" class="btn-danger">Delete</button>
    `;

    // Add class for styling
    popup.classList.add('confirmation');

    // Show the popup
    popupContainer.classList.remove('hidden');
    setTimeout(() => {
        popupContainer.classList.add('active');
    }, 10);

    // Set up close handlers
    const closePopup = () => {
        popupContainer.classList.remove('active');
        setTimeout(() => {
            popupContainer.classList.add('hidden');

            // Restore original footer
            popupFooter.innerHTML = originalFooter;

            // Remove confirmation class
            popup.classList.remove('confirmation');
        }, 300);
    };

    document.getElementById('popup-close').onclick = closePopup;
    document.getElementById('popup-cancel').onclick = closePopup;

    // Set up confirm handler
    document.getElementById('popup-confirm').onclick = async () => {
        closePopup();
        await deletePoll(pollId);
    };

    // Close when clicking outside
    popupContainer.addEventListener('click', (e) => {
        if (e.target === popupContainer) {
            closePopup();
        }
    });
}

async function deletePoll(pollId) {
    loading.classList.remove('hidden');

    const result = await fetchAPI(`/polls/${pollId}`, {
        method: 'DELETE'
    });

    if (result) {
        loadAdminPolls();
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
        return;
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
        document.getElementById('create-poll-form').reset();
        navigateTo('admin-dashboard');
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
        return;
    }

    // Collect the rankings from all options that have a rank selected
    const rankings = [];
    const optionRows = document.querySelectorAll('.option-rank-row');

    optionRows.forEach(row => {
        const optionId = row.dataset.optionId;
        const selectedRankBtn = row.querySelector('.rank-button.selected');

        if (selectedRankBtn) {
            const rank = parseInt(selectedRankBtn.dataset.rank);
            rankings.push({
                option: optionId,
                rank: rank
            });
        }
    });

    if (rankings.length === 0) {
        showPopup('Please rank at least one option.', 'Error', 'error');
        return;
    }

    const voteData = {
        email,
        poll_id: currentPollId,
        rankings: {}
    };

    rankings.forEach(item => {
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
        // Clear any existing flags first to ensure clean state
        localStorage.removeItem(`just_voted_${currentPollId}`);
        
        // Store vote data and set the just-voted flag
        localStorage.setItem(`voter_${currentPollId}`, email);
        localStorage.setItem(`voter_rankings_${currentPollId}`, JSON.stringify(voteData.rankings));
        localStorage.setItem(`just_voted_${currentPollId}`, 'true');
        
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
        return;
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
 * @param {Object} userVote - The user's vote data if they just voted
 */
function renderResultsVisualization(resultsData, userVote = null) {
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

    // Clear previous results and any existing explanations
    round1Results.innerHTML = '';
    additionalRounds.innerHTML = '';

    // Remove any existing explanation divs
    const resultsContainer = round1Results.parentElement;
    const existingExplanations = resultsContainer.querySelectorAll('.rcv-explanation');
    existingExplanations.forEach(explanation => explanation.remove());

    // Add an explanatory header
    const explanationDiv = document.createElement('div');
    explanationDiv.className = 'rcv-explanation';
    explanationDiv.innerHTML = `
        <div class="rcv-intro">
            <h4>How Ranked Choice Voting Works</h4>
            <p>In ranked choice voting, if no candidate gets a majority (more than 50%) of first-choice votes, 
            the candidate with the fewest votes is eliminated and their votes are redistributed to voters' 
            next choices. This process continues until one candidate has a majority.</p>
        </div>
    `;
    resultsContainer.insertBefore(explanationDiv, resultsContainer.firstChild);

    // Determine the maximum vote count for scaling
    let maxVotes = 0;
    rounds.forEach(round => {
        if (round.counts) {
            Object.values(round.counts).forEach(count => {
                if (count > maxVotes) maxVotes = count;
            });
        }
    });

    // Calculate total votes in first round for majority threshold
    const totalVotes = rounds[0] && rounds[0].counts ? 
        Object.values(rounds[0].counts).reduce((sum, count) => sum + count, 0) : 0;
    const majorityThreshold = Math.floor(totalVotes / 2) + 1;

    // Helper function to determine which option is receiving the user's vote in this round
    function getUserVoteInRound(round, userVote) {
        if (!userVote || !userVote.rankings) return null;

        // Convert string option IDs to their text representation
        const optionIdToText = {};
        if (currentPoll && currentPoll.options) {
            currentPoll.options.forEach(option => {
                if (typeof option === 'object' && option.id && option.text) {
                    optionIdToText[option.id] = option.text;
                } else if (typeof option === 'string') {
                    // If option is just a string, use it as both id and text
                    optionIdToText[option] = option;
                }
            });
        }

        // Find the user's highest ranked option that is still in this round
        let activeOptions = Object.keys(round.counts);
        let userRankings = [...Object.entries(userVote.rankings)]
            .map(([optId, rank]) => ({ 
                optionId: optId, 
                optionText: optionIdToText[optId] || optId,
                rank 
            }))
            .sort((a, b) => a.rank - b.rank); // Sort by rank (1st, 2nd, 3rd...)

        // Find the highest ranked option that's still active
        for (const ranking of userRankings) {
            if (activeOptions.includes(ranking.optionText)) {
                return ranking.optionText;
            }
        }

        return null; // No active vote in this round
    }

    // Helper function to describe the journey of the user's vote
    function getUserVoteJourney(rounds, userVote) {
        if (!userVote || !userVote.rankings) return '';

        const journey = [];
        for (let i = 0; i < rounds.length; i++) {
            const userVoteInRound = getUserVoteInRound(rounds[i], userVote);
            if (userVoteInRound) {
                if (i === 0) {
                    journey.push(`started with ${userVoteInRound}`);
                } else {
                    journey.push(`transferred to ${userVoteInRound} in round ${i + 1}`);
                }
                
                // Check if this is where it ended
                if (rounds[i].winner === userVoteInRound) {
                    journey.push(`and helped elect the winner!`);
                    break;
                } else if (rounds[i].eliminated === userVoteInRound && i < rounds.length - 1) {
                    // Vote will transfer in next round
                }
            }
        }

        return journey.length > 0 ? journey.join(', ') + '.' : 'was cast but did not affect the final outcome.';
    }

    // Render Round 1
    if (rounds.length > 0) {
        const round1 = rounds[0];
        
        // Add round header with explanation
        const roundHeader = document.createElement('div');
        roundHeader.className = 'round-header';
        roundHeader.innerHTML = `
            <h3>Round 1 - Initial Vote Count</h3>
            <p class="round-explanation">
                First-choice votes are counted. ${totalVotes} total votes cast. 
                A candidate needs ${majorityThreshold} votes (majority) to win.
            </p>
        `;
        round1Results.appendChild(roundHeader);
        
        // Determine where the user's vote is in this round
        const userVoteOption = userVote ? getUserVoteInRound(round1, userVote) : null;

        if (!round1.counts) {
            round1Results.innerHTML += '<p>No vote data available</p>';
        } else {
            // Check if there's a winner in round 1
            const hasWinner = Object.values(round1.counts).some(count => count >= majorityThreshold);
            
            Object.keys(round1.counts).forEach(optionText => {
                const votes = round1.counts[optionText];
                const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                const votePercentage = totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(1) : 0;

                const isEliminated = round1.eliminated === optionText;
                const isWinner = round1.winner === optionText;
                const isUserVote = optionText === userVoteOption;

                const resultBar = document.createElement('div');
                resultBar.className = 'result-bar-container';

                let barClass = 'result-bar-inner';
                if (isEliminated) barClass += ' eliminated';
                if (isWinner) barClass += ' winner';

                let statusText = '';
                let statusExplanation = '';
                if (isWinner && hasWinner) {
                    statusText += ' (Winner)';
                    statusExplanation = ` - Won with ${votePercentage}% of the vote`;
                } else if (isEliminated) {
                    statusText += ' (Eliminated)';
                    statusExplanation = ` - Fewest votes, eliminated first`;
                } else if (votes >= majorityThreshold) {
                    statusExplanation = ` - Has majority (${votePercentage}%)`;
                } else {
                    statusExplanation = ` - ${votePercentage}% of votes`;
                }
                
                resultBar.innerHTML = `
                    <div class="result-bar-label">
                        <span>${escapeHTML(optionText)}${isUserVote ? '<span class="your-vote-badge">Your Vote</span>' : ''}</span>
                        <span>${votes} vote${votes !== 1 ? 's' : ''}${statusExplanation}</span>
                    </div>
                    <div class="result-bar-outer">
                        <div class="${barClass}" style="width: ${percentage}%;">
                            ${votes}${statusText}
                        </div>
                    </div>
                `;

                round1Results.appendChild(resultBar);
            });
            
            // Add explanation if no winner
            if (!hasWinner && rounds.length > 1) {
                const noWinnerExplanation = document.createElement('div');
                noWinnerExplanation.className = 'round-conclusion';
                noWinnerExplanation.innerHTML = `
                    <p><strong>No candidate reached the majority threshold of ${majorityThreshold} votes.</strong> 
                    The candidate with the fewest votes (${round1.eliminated}) is eliminated, and 
                    their votes are redistributed to voters' next choices.</p>
                `;
                round1Results.appendChild(noWinnerExplanation);
            }
        }
    }

    // Render additional rounds
    if (rounds.length > 1) {
        for (let i = 1; i < rounds.length; i++) {
            const round = rounds[i];
            const previousRound = rounds[i - 1];
            const roundDiv = document.createElement('div');
            roundDiv.className = 'round-results';
            
            // Calculate remaining total votes for this round
            const roundTotalVotes = round.counts ? 
                Object.values(round.counts).reduce((sum, count) => sum + count, 0) : 0;
            const roundMajorityThreshold = Math.floor(roundTotalVotes / 2) + 1;
            
            // Add round header with explanation
            const roundHeader = document.createElement('div');
            roundHeader.className = 'round-header';
            const isLastRound = i === rounds.length - 1;
            
            roundHeader.innerHTML = `
                <h3>Round ${i + 1}${isLastRound ? ' - Final Round' : ''}</h3>
                <p class="round-explanation">
                    ${previousRound.eliminated} was eliminated. Their ${previousRound.counts[previousRound.eliminated]} votes 
                    were redistributed to voters' next choices. ${roundTotalVotes} votes remain active.
                    ${isLastRound ? '' : `A candidate needs ${roundMajorityThreshold} votes to win.`}
                </p>
            `;
            roundDiv.appendChild(roundHeader);

            // Determine where the user's vote is in this round
            const userVoteOption = userVote ? getUserVoteInRound(round, userVote) : null;

            if (!round.counts) {
                roundDiv.innerHTML += '<p>No vote data available for this round</p>';
                additionalRounds.appendChild(roundDiv);
                continue;
            }

            // Check if there's a winner in this round
            const hasWinner = round.winner !== undefined;

            Object.keys(round.counts).forEach(optionText => {
                const votes = round.counts[optionText];
                const percentage = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
                const votePercentage = roundTotalVotes > 0 ? ((votes / roundTotalVotes) * 100).toFixed(1) : 0;

                const isEliminated = round.eliminated === optionText;
                const isWinner = round.winner === optionText;
                const isUserVote = optionText === userVoteOption;

                // Calculate vote changes from previous round
                const previousVotes = (previousRound.counts && previousRound.counts[optionText]) || 0;
                const voteChange = votes - previousVotes;
                const changeText = voteChange > 0 ? ` (+${voteChange})` : voteChange < 0 ? ` (${voteChange})` : '';

                const resultBar = document.createElement('div');
                resultBar.className = 'result-bar-container';

                let barClass = 'result-bar-inner';
                if (isEliminated) barClass += ' eliminated';
                if (isWinner) barClass += ' winner';
                if (isUserVote) barClass += ' your-vote';

                let statusText = '';
                let statusExplanation = '';
                if (isWinner) {
                    statusText += ' (Winner)';
                    statusExplanation = ` - Won with ${votePercentage}% of remaining votes`;
                } else if (isEliminated) {
                    statusText += ' (Eliminated)';
                    statusExplanation = ` - Fewest votes${changeText}, eliminated next`;
                } else {
                    statusExplanation = ` - ${votePercentage}% of votes${changeText}`;
                }

                resultBar.innerHTML = `
                    <div class="result-bar-label">
                        <span>${escapeHTML(optionText)}${isUserVote ? '<span class="your-vote-badge">Your Vote</span>' : ''}</span>
                        <span>${votes} vote${votes !== 1 ? 's' : ''}${statusExplanation}</span>
                    </div>
                    <div class="result-bar-outer">
                        <div class="${barClass}" style="width: ${percentage}%;">
                            ${votes}${statusText}
                        </div>
                    </div>
                `;

                roundDiv.appendChild(resultBar);
            });

            // Add conclusion for each round
            if (hasWinner) {
                const winnerConclusion = document.createElement('div');
                winnerConclusion.className = 'round-conclusion winner-conclusion';
                winnerConclusion.innerHTML = `
                    <p><strong>${round.winner} wins!</strong> 
                    They received ${round.counts[round.winner]} votes (${((round.counts[round.winner] / roundTotalVotes) * 100).toFixed(1)}%) 
                    in the final round, achieving the majority needed to win.</p>
                `;
                roundDiv.appendChild(winnerConclusion);
            } else if (round.eliminated && i < rounds.length - 1) {
                const eliminationConclusion = document.createElement('div');
                eliminationConclusion.className = 'round-conclusion';
                eliminationConclusion.innerHTML = `
                    <p><strong>Still no majority winner.</strong> 
                    ${round.eliminated} has the fewest votes and is eliminated. 
                    Their votes will be redistributed in the next round.</p>
                `;
                roundDiv.appendChild(eliminationConclusion);
            }

            additionalRounds.appendChild(roundDiv);
        }
    }

    // Add a final summary if there are multiple rounds
    if (rounds.length > 1) {
        const finalSummary = document.createElement('div');
        finalSummary.className = 'final-summary';
        const finalRound = rounds[rounds.length - 1];
        const winner = finalRound.winner;
        finalSummary.innerHTML = `
            <div class="summary-box">
                <h4>Election Summary</h4>
                <p><strong>${winner}</strong> won this ranked choice election after ${rounds.length} round${rounds.length > 1 ? 's' : ''} of counting.</p>
                ${userVote ? `<p class="your-vote-summary">Your vote ${getUserVoteJourney(rounds, userVote)}</p>` : ''}
            </div>
        `;
        additionalRounds.appendChild(finalSummary);
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

    toast.innerHTML = `
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

document.getElementById('create-poll-btn').addEventListener('click', () => {
    navigateTo('create-poll');
});

document.getElementById('cancel-create').addEventListener('click', () => {
    navigateTo('admin-dashboard');
});
