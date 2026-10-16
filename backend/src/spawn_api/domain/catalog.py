"""Spawn's vocabulary: experience types and rarities.

These mirror the frontend's src/data/catalog.ts. They are StrEnums so they serialize to the same
plain strings ("music", "rare") in the database, in JSON responses and in the TypeScript types.
"""

from enum import StrEnum


class SpawnType(StrEnum):
    MUSIC = "music"
    FOOD = "food"
    NIGHT = "night"
    CULTURE = "culture"
    SPORT = "sport"
    NATURE = "nature"
    SOCIAL = "social"


class Rarity(StrEnum):
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"
    LEGENDARY = "legendary"


class IngestionStatus(StrEnum):
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
