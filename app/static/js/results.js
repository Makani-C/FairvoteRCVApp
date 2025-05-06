document.addEventListener('DOMContentLoaded', function() {
    const roundsContainer = document.getElementById('rounds-container');
    const resultsChart = document.getElementById('results-chart');

    if (roundsContainer) {
        const pollId = roundsContainer.getAttribute('data-poll-id');

        // Fetch round-by-round results
        fetch(`/results/api/poll/${pollId}`)
            .then(response => response.json())
            .then(data => {
                // Remove loading spinner
                roundsContainer.innerHTML = '';

                if (!data.results || data.votes_count === 0) {
                    roundsContainer.innerHTML = '<div class="alert alert-warning">No votes have been submitted yet.</div>';
                    return;
                }

                // Create round cards
                data.results.rounds.forEach((round, index) => {
                    const roundCard = document.createElement('div');
                    roundCard.className = 'round-card';

                    let roundHtml = `
                        <div class="round-title">
                            <h3 class="h5">Round ${round.round}</h3>
                            <p>Eliminated: <strong class="text-danger">${round.eliminated}</strong></p>
                        </div>
                        <div class="round-results">
                    `;

                    // Add each option's results
                    Object.entries(round.counts).forEach(([option, count]) => {
                        const percentage = round.percentages[option].toFixed(1);
                        const isEliminated = option === round.eliminated;

                        roundHtml += `
                            <div class="option-result ${isEliminated ? 'eliminated' : ''}">
                                <div class="d-flex justify-content-between mb-1">
                                    <span>${option}</span>
                                    <span>${count} votes (${percentage}%)</span>
                                </div>
                                <div class="progress">
                                    <div class="progress-bar ${isEliminated ? 'bg-danger' : 'bg-success'}" 
                                         role="progressbar" 
                                         style="width: ${percentage}%" 
                                         aria-valuenow="${percentage}" 
                                         aria-valuemin="0" 
                                         aria-valuemax="100">
                                        ${percentage}%
                                    </div>
                                </div>
                            </div>
                        `;
                    });

                    roundHtml += '</div>';
                    roundCard.innerHTML = roundHtml;
                    roundsContainer.appendChild(roundCard);
                });

                // Create visualization if we have a chart element
                if (resultsChart) {
                    createVisualization(data.results);
                }
            })
            .catch(error => {
                console.error('Error fetching results:', error);
                roundsContainer.innerHTML = `<div class="alert alert-danger">Error loading results: ${error.message}</div>`;
            });
    }

    // Function to create chart visualization
    function createVisualization(results) {
        if (!results || !results.rounds || results.rounds.length === 0) return;

        const rounds = results.rounds;
        const labels = rounds.map(round => `Round ${round.round}`);

        // Get all options across all rounds
        const allOptions = new Set();
        rounds.forEach(round => {
            Object.keys(round.counts).forEach(option => allOptions.add(option));
        });

        // Prepare datasets
        const datasets = [];
        const colors = [
            '#4dc9f6', '#f67019', '#f53794', '#537bc4',
            '#acc236', '#166a8f', '#00a950', '#58595b',
            '#8549ba', '#0097c4', '#d62728', '#2ca02c'
        ];

        // Create a dataset for each option
        Array.from(allOptions).forEach((option, index) => {
            const data = [];

            rounds.forEach(round => {
                // If option exists in this round, add its vote count, otherwise 0
                if (round.counts[option] !== undefined) {
                    data.push(round.counts[option]);
                } else {
                    data.push(0);
                }
            });

            // Add winner to final round
            if (option === results.winner && data.length > 0) {
                // Add one more data point for the final result
                data.push(data[data.length - 1]);

                if (labels.length < data.length) {
                    labels.push('Final Result');
                }
            }

            datasets.push({
                label: option,
                data: data,
                backgroundColor: colors[index % colors.length],
                borderColor: colors[index % colors.length],
                borderWidth: 2,
                fill: false
            });
        });

        // Create chart
        new Chart(resultsChart, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Votes'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Rounds'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Ranked Choice Voting Results',
                        font: {
                            size: 16
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
});
