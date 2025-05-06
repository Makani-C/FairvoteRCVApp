document.addEventListener('DOMContentLoaded', function() {
    // Initialize sortable options list if on voting page
    const sortableList = document.getElementById('sortable-options');
    if (sortableList) {
        new Sortable(sortableList, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost'
        });

        // Handle voting form submission
        const votingForm = document.getElementById('voting-form');
        if (votingForm) {
            const pollId = votingForm.getAttribute('data-poll-id');

            votingForm.addEventListener('submit', function(e) {
                e.preventDefault();

                const email = document.getElementById('email').value;
                if (!email) {
                    alert('Please enter your email address.');
                    return;
                }

                // Get rankings from the sorted list
                const rankings = {};
                document.querySelectorAll('#sortable-options li').forEach((item, index) => {
                    const optionId = item.getAttribute('data-option-id');
                    rankings[optionId] = index + 1; // Rank starts at 1
                });

                // Submit vote
                fetch(`/votes/?poll_id=${pollId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        rankings: rankings
                    }),
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.detail || 'Failed to submit vote');
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    alert('Your vote has been submitted successfully!');
                    window.location.href = `/results/poll/${pollId}`;
                })
                .catch(error => {
                    alert(error.message);
                });
            });
        }
    }

    // Handle poll creation if on the create poll page
    const createPollForm = document.getElementById('create-poll-form');
    if (createPollForm) {
        // Add option button
        const addOptionBtn = document.getElementById('add-option');
        const optionsContainer = document.getElementById('options-container');

        addOptionBtn.addEventListener('click', function() {
            const newOption = document.createElement('div');
            newOption.className = 'input-group mb-2';
            newOption.innerHTML = `
                <input type="text" class="form-control option-input" name="options[]" required>
                <button type="button" class="btn btn-outline-danger remove-option">✕</button>
            `;
            optionsContainer.appendChild(newOption);
        });

        // Remove option
        optionsContainer.addEventListener('click', function(e) {
            if (e.target.classList.contains('remove-option') || e.target.parentNode.classList.contains('remove-option')) {
                const button = e.target.classList.contains('remove-option') ? e.target : e.target.parentNode;
                const inputGroup = button.parentNode;

                // Only remove if we have more than 2 options
                if (document.querySelectorAll('.option-input').length > 2) {
                    inputGroup.remove();
                } else {
                    alert('You need at least two options for a poll.');
                }
            }
        });

        // Handle form submission
        createPollForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const title = document.getElementById('title').value;
            const description = document.getElementById('description').value;

            // Get all options
            const optionInputs = document.querySelectorAll('.option-input');
            const options = Array.from(optionInputs).map(input => input.value);

            // Validate
            if (!title) {
                alert('Please enter a poll title.');
                return;
            }

            if (options.length < 2) {
                alert('You need at least two options for a poll.');
                return;
            }

            // Check for empty options
            const emptyOptions = options.filter(opt => !opt.trim());
            if (emptyOptions.length > 0) {
                alert('All options must have a value.');
                return;
            }

            // Submit to create poll
            fetch('/polls/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: title,
                    description: description,
                    options: options
                }),
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.detail || 'Failed to create poll');
                    });
                }
                return response.json();
            })
            .then(data => {
                alert('Poll created successfully!');
                window.location.href = `/votes/form/${data.id}`;
            })
            .catch(error => {
                alert(error.message);
            });
        });
    }
});
