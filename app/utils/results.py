from typing import List, Dict, Any, Optional, Set
from database.models import Vote, Option


def calculate_ranked_choice_results(votes: List[Vote], options: List[Option]) -> Dict[str, Any]:
    """
    Calculate ranked choice voting results with round-by-round elimination.

    Implements a standard Instant-Runoff Voting (IRV) algorithm where:
    1. If any option receives >50% of first-choice votes, it wins immediately
    2. Otherwise, the option with the fewest first-choice votes is eliminated
    3. Votes for eliminated options are redistributed to voters' next choices
    4. Process repeats until one option achieves majority or only one remains

    Args:
        votes: List of Vote objects containing voter rankings
        options: List of Option objects representing available choices

    Returns:
        Dictionary with:
        - rounds: List of round-by-round results, including vote counts and percentages
        - winner: The winning option (either with >50% support or last remaining)
        - eliminated: List of eliminated options in order of elimination
        - win_threshold: The number of votes needed to secure majority
    """
    # Handle empty input case
    if not votes or not options:
        return {"rounds": [], "winner": None, "eliminated": [], "win_threshold": 0}

    # Map option IDs to their text representation
    option_map = {option.id: option.text for option in options}

    # Initialize tracking variables
    remaining_option_ids: Set[int] = set(option_map.keys())
    eliminated_option_ids: List[int] = []
    rounds_results: List[Dict[str, Any]] = []

    round_num = 1
    # Continue elimination rounds until only one option remains or no valid votes
    while len(remaining_option_ids) > 1:
        # Initialize vote counts for this round
        round_counts: Dict[int, int] = {option_id: 0 for option_id in remaining_option_ids}
        total_valid_votes = 0

        # Count first-choice votes for each voter
        for vote in votes:
            top_choice = _find_top_choice(vote, remaining_option_ids)
            if top_choice is not None:
                round_counts[top_choice] += 1
                total_valid_votes += 1

        # If no valid votes remain, we can't continue
        if total_valid_votes == 0:
            break

        # Calculate the threshold for majority win (50% + 1)
        win_threshold = (total_valid_votes // 2) + 1

        # Calculate percentages for this round
        round_percentages = {
            option_id: round((count / total_valid_votes * 100), 2)
            for option_id, count in round_counts.items()
        }

        # Check if any option has achieved majority (>50%)
        majority_winner = None
        for option_id, count in round_counts.items():
            if count >= win_threshold:
                majority_winner = option_id
                break

        # Record this round's results
        current_round = {
            "round": round_num,
            "counts": round_counts,
            "percentages": round_percentages,
            "total_votes": total_valid_votes,
            "win_threshold": win_threshold
        }

        # If we have a majority winner, record and exit
        if majority_winner is not None:
            current_round["winner"] = majority_winner
            rounds_results.append(current_round)
            # Set winner and break the loop
            winner = majority_winner
            break

        # No majority winner, so determine which option to eliminate
        option_to_eliminate = _select_option_to_eliminate(round_counts)
        if option_to_eliminate is None:
            break  # Unable to determine an option to eliminate

        # Add elimination info to the round results
        current_round["eliminated"] = option_to_eliminate
        rounds_results.append(current_round)

        # Update tracking variables for next round
        remaining_option_ids.remove(option_to_eliminate)
        eliminated_option_ids.append(option_to_eliminate)
        round_num += 1

    # If we didn't find a majority winner but the loop ended,
    # the winner is the last option remaining (if any)
    if 'winner' not in locals():
        winner = next(iter(remaining_option_ids)) if remaining_option_ids else None

    # Format the final results with human-readable option names
    results = {
        "rounds": [
            {
                "round": r["round"],
                "counts": {option_map[option_id]: count for option_id, count in r["counts"].items()},
                "percentages": {option_map[option_id]: pct for option_id, pct in r["percentages"].items()},
                "total_votes": r["total_votes"],
                "win_threshold": r["win_threshold"],
                **({"winner": option_map[r["winner"]]} if "winner" in r else {
                    "eliminated": option_map[r["eliminated"]]}),
            }
            for r in rounds_results
        ],
        "winner": option_map[winner] if winner else None,
        "eliminated": [option_map[option_id] for option_id in eliminated_option_ids],
        "win_threshold": rounds_results[-1]["win_threshold"] if rounds_results else 0
    }

    return results


def _find_top_choice(vote: Vote, remaining_option_ids: Set[int]) -> Optional[int]:
    """
    Find a voter's highest-ranked option among those that remain in the election.

    Args:
        vote: A Vote object containing ranking preferences
        remaining_option_ids: Set of option IDs still in contention

    Returns:
        Option ID of the highest ranked remaining choice, or None if no valid choices remain
    """
    # Ensure consistent type handling by converting all option IDs to integers
    valid_rankings: Dict[int, int] = {}

    for option_id_str, rank in vote.rankings.items():
        try:
            option_id = int(option_id_str)
            if option_id in remaining_option_ids:
                valid_rankings[option_id] = int(rank)
        except (ValueError, TypeError):
            # Skip invalid option IDs or rankings
            continue

    if not valid_rankings:
        return None

    # Find the option with the lowest rank value (highest preference)
    return min(valid_rankings.items(), key=lambda x: x[1])[0]


def _select_option_to_eliminate(round_counts: Dict[int, int]) -> Optional[int]:
    """
    Select which option to eliminate based on vote counts.

    In standard IRV, the option with the fewest votes is eliminated.
    In case of a tie for fewest votes, this implementation uses a simple
    deterministic approach by selecting the option with the lowest ID.
    A more sophisticated approach might involve random selection or
    additional tie-breaking rules.

    Args:
        round_counts: Dictionary mapping option IDs to their vote counts

    Returns:
        Option ID to eliminate, or None if no valid options to eliminate
    """
    if not round_counts:
        return None

    min_votes = min(round_counts.values())

    # Find all options with the minimum vote count
    tied_options = [
        option_id for option_id, count in round_counts.items()
        if count == min_votes
    ]

    # Use a deterministic tie-breaking method
    return min(tied_options) if tied_options else None
