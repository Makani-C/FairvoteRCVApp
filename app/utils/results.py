from typing import List, Dict, Any, Optional, Set, Tuple
from database.models import Vote, Option
from collections import Counter
from dataclasses import dataclass


@dataclass
class RoundResult:
    """Data class to store the results of a single round."""
    round_num: int
    vote_counts: Dict[int, int]
    percentages: Dict[int, float]
    total_votes: int
    win_threshold: int
    winner: Optional[int] = None
    eliminated: Optional[int] = None


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

    # Gather all rankings into a more efficient format for processing
    voter_preferences = [_parse_voter_preferences(vote) for vote in votes]

    # Initialize tracking variables
    remaining_option_ids: Set[int] = set(option_map.keys())
    eliminated_option_ids: List[int] = []
    rounds_results: List[RoundResult] = []

    # Continue elimination rounds until a winner is found or only one option remains
    round_num = 1
    winner = None

    while len(remaining_option_ids) > 1 and winner is None:
        # Count first-choice votes for this round
        round_result = _calculate_round_results(
            voter_preferences,
            remaining_option_ids,
            round_num
        )

        # If no valid votes remain, we can't continue
        if round_result.total_votes == 0:
            break

        # Check if any option has achieved majority
        for option_id, count in round_result.vote_counts.items():
            if count >= round_result.win_threshold:
                round_result.winner = option_id
                winner = option_id
                break

        if winner is None:
            # First eliminate all zero-vote options
            zero_vote_options = [
                option_id for option_id, count in round_result.vote_counts.items()
                if count == 0
            ]
            vote_counts = round_result.vote_counts
            for option_id in zero_vote_options:
                remaining_option_ids.remove(option_id)
                eliminated_option_ids.append(option_id)
                vote_counts.pop(option_id)

            option_to_eliminate = _select_option_to_eliminate(round_result.vote_counts)

            if option_to_eliminate is None:
                break

            round_result.eliminated = option_to_eliminate
            remaining_option_ids.remove(option_to_eliminate)
            eliminated_option_ids.append(option_to_eliminate)


        rounds_results.append(round_result)
        round_num += 1

    # If we didn't find a majority winner but the loop ended,
    # the winner is the last option remaining (if any)
    if winner is None and remaining_option_ids:
        winner = next(iter(remaining_option_ids))

    # Format the final results with human-readable option names
    results = {
        "rounds": [_format_round_result(r, option_map) for r in rounds_results],
        "winner": option_map.get(winner) if winner else None,
        "eliminated": [option_map.get(option_id) for option_id in eliminated_option_ids],
        "win_threshold": rounds_results[-1].win_threshold if rounds_results else 0
    }

    return results


def _parse_voter_preferences(vote: Vote) -> Dict[int, int]:
    """Parse a voter's preferences into a consistent format."""
    preferences = {}
    for option_id_str, rank in vote.rankings.items():
        try:
            preferences[int(option_id_str)] = int(rank)
        except (ValueError, TypeError):
            # Skip invalid option IDs or rankings
            continue
    return preferences


def _calculate_round_results(
        voter_preferences: List[Dict[int, int]],
        remaining_options: Set[int],
        round_num: int
) -> RoundResult:
    """Calculate the results for a single round of voting."""
    # Count first-choice votes
    vote_counts = Counter()

    for preferences in voter_preferences:
        top_choice = _find_top_choice(preferences, remaining_options)
        if top_choice:
            vote_counts[top_choice] += 1

    total_valid_votes = sum(vote_counts.values())

    # Calculate the threshold for majority win (50% + 1)
    win_threshold = (total_valid_votes // 2) + 1 if total_valid_votes > 0 else 0

    # Calculate percentages
    percentages = {
        option_id: round((count / total_valid_votes * 100), 2) if total_valid_votes > 0 else 0
        for option_id, count in vote_counts.items()
    }

    # Ensure all remaining options have an entry, even if zero votes
    for option_id in remaining_options:
        if option_id not in vote_counts:
            vote_counts[option_id] = 0
            percentages[option_id] = 0.0

    return RoundResult(
        round_num=round_num,
        vote_counts=dict(vote_counts),
        percentages=percentages,
        total_votes=total_valid_votes,
        win_threshold=win_threshold
    )


def _find_top_choice(preferences: Dict[int, int], remaining_options: Set[int]) -> Optional[int]:
    """Find a voter's highest-ranked option among those that remain in the election."""
    valid_preferences = {
        option_id: rank for option_id, rank in preferences.items()
        if option_id in remaining_options
    }

    if not valid_preferences:
        return None

    # Find the option with the lowest rank value (highest preference)
    return min(valid_preferences.items(), key=lambda x: x[1])[0]


def _select_option_to_eliminate(vote_counts: Dict[int, int]) -> Optional[int]:
    """
    Select which option to eliminate based on vote counts.

    In standard IRV, the option with the fewest votes is eliminated.
    In case of a tie for fewest votes, this implementation eliminates
    the option with the lowest ID for deterministic results.
    """
    if not vote_counts:
        return None

    min_votes = min(vote_counts.values())

    # Find all options with the minimum vote count
    tied_options = [
        option_id for option_id, count in vote_counts.items()
        if count == min_votes
    ]

    return min(tied_options) if tied_options else None


def _format_round_result(round_result: RoundResult, option_map: Dict[int, str]) -> Dict[str, Any]:
    """Format round results with human-readable option names."""
    formatted = {
        "round": round_result.round_num,
        "counts": {option_map[option_id]: count
                   for option_id, count in round_result.vote_counts.items()},
        "percentages": {option_map[option_id]: pct
                        for option_id, pct in round_result.percentages.items()},
        "total_votes": round_result.total_votes,
        "win_threshold": round_result.win_threshold
    }

    if round_result.winner is not None:
        formatted["winner"] = option_map[round_result.winner]
    elif round_result.eliminated is not None:
        formatted["eliminated"] = option_map[round_result.eliminated]

    return formatted
