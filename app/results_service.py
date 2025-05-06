from typing import List, Dict, Any
from models import Vote, Option


def calculate_ranked_choice_results(votes: List[Vote], options: List[Option]) -> Dict[str, Any]:
    """
    Calculate ranked choice voting results with round-by-round elimination

    Returns a dictionary with:
    - rounds: List of round results
    - winner: The winning option
    - eliminated: List of eliminated options in order
    """
    # Map option IDs to their text
    option_map = {opt.id: opt.text for opt in options}

    # Initialize counters and tracking variables
    remaining_options = set(option_map.keys())
    eliminated_options = []
    rounds_results = []

    # Continue until we have a winner
    round_num = 1
    while len(remaining_options) > 1:
        # Count first choice votes for each option in this round
        round_counts = {option_id: 0 for option_id in remaining_options}

        for vote in votes:
            # Get the highest ranked remaining option for this voter
            rankings = vote.rankings

            # Sort the rankings by value (lower value = higher rank)
            sorted_rankings = sorted(
                [(int(opt_id), rank) for opt_id, rank in rankings.items() if int(opt_id) in remaining_options],
                key=lambda x: x[1]
            )

            if sorted_rankings:
                # Get the highest ranked remaining option
                top_choice = sorted_rankings[0][0]
                round_counts[top_choice] += 1

        # Calculate percentages for this round
        total_votes = sum(round_counts.values())
        round_percentages = {
            option_id: (count / total_votes * 100) if total_votes > 0 else 0
            for option_id, count in round_counts.items()
        }

        # Find option with the fewest votes to eliminate
        if round_counts:
            min_votes = min(round_counts.values())
            to_eliminate = [
                option_id for option_id, count in round_counts.items()
                if count == min_votes
            ]

            # If there's a tie for elimination, eliminate one option
            # In a real system, you might want to handle ties differently
            option_to_eliminate = to_eliminate[0]

            # Save this round's results
            rounds_results.append({
                "round": round_num,
                "counts": round_counts,
                "percentages": round_percentages,
                "eliminated": option_to_eliminate
            })

            # Remove the eliminated option
            remaining_options.remove(option_to_eliminate)
            eliminated_options.append(option_to_eliminate)

            round_num += 1
        else:
            # No votes were cast (should not happen normally)
            break

    # The last remaining option is the winner
    winner = list(remaining_options)[0] if remaining_options else None

    # Format the final results
    results = {
        "rounds": [
            {
                "round": r["round"],
                "counts": {option_map[opt_id]: count for opt_id, count in r["counts"].items()},
                "percentages": {option_map[opt_id]: pct for opt_id, pct in r["percentages"].items()},
                "eliminated": option_map[r["eliminated"]]
            }
            for r in rounds_results
        ],
        "winner": option_map[winner] if winner else None,
        "eliminated": [option_map[opt_id] for opt_id in eliminated_options]
    }

    return results
