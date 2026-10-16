"""How rare a spawn is.

TODO(SPAWN-12, copilot-practice): implement the rules below and their tests. This story is reserved
for the project owner to write with GitHub Copilot; until then every spawn is Common.

Suggested rules (a starting point, adjust them and document your choices):
  - Legendary: a one-day event of a type that is rare in the data (e.g. circus), or outdoors
  - Rare: a one-day event (most city events are single-day)
  - Uncommon: runs 2 to 30 days
  - Common: runs longer than 30 days (long exhibitions)
Write the tests first in tests/unit/test_rarity.py, one per rule, including the boundaries
(exactly 1 day, exactly 30 days).
"""

from datetime import date

from spawn_api.domain.catalog import Rarity, SpawnType


def rarity_for(spawn_type: SpawnType, first_day: date, last_day: date, *, is_outdoor: bool) -> Rarity:
    """Rarity of a spawn from its type and how long it runs (inclusive dates)."""
    del spawn_type, first_day, last_day, is_outdoor  # used once SPAWN-12 is implemented
    return Rarity.COMMON
