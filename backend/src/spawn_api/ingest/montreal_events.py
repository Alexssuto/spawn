"""City of Montréal public events calendar ("Événements publics", CC BY 4.0, updated daily).

Every rule here comes from profiling the real file (Oct 2026); see
docs/architecture/phase-2a-backend.md for the findings.
"""

from collections.abc import Callable
from datetime import date
from typing import Annotated, Any, ClassVar

from pydantic import BaseModel, BeforeValidator, ConfigDict, ValidationError

from spawn_api.domain.catalog import SpawnType
from spawn_api.domain.normalized import NormalizedSpawn, all_day_window
from spawn_api.domain.rarity import rarity_for
from spawn_api.ingest.base import Accepted, EventSource, ParseResult, Record, Rejected, Skipped, SourceInfo
from spawn_api.ingest.cleaning import blank_to_none, json_safe
from spawn_api.ingest.http import download_json

GEOJSON_URL = (
    "https://donnees.montreal.ca/dataset/6a4cbf2c-c9b7-413a-86b1-e8f7081e2578/resource/"
    "35307457-a00f-4912-9941-8095ead51f6e/download/evenements.geojson"
)

# City category → Spawn type. Every category seen in the data must appear here or in EXCLUDED;
# a new category shows up as a rejection ("unmapped category") instead of being guessed.
CATEGORY_TO_TYPE: dict[str, SpawnType] = {
    "Musique": SpawnType.MUSIC,
    "Initiation à la musique": SpawnType.MUSIC,
    "Danse": SpawnType.MUSIC,
    "Cuisine": SpawnType.FOOD,
    "Humour": SpawnType.NIGHT,
    "Art et artisanat": SpawnType.CULTURE,
    "Théâtre": SpawnType.CULTURE,
    "Exposition": SpawnType.CULTURE,
    "Cinéma": SpawnType.CULTURE,
    "Cirque": SpawnType.CULTURE,
    "Art de la parole": SpawnType.CULTURE,
    "Club de lecture et littérature": SpawnType.CULTURE,
    "Heure du conte": SpawnType.CULTURE,
    "Science et techno": SpawnType.CULTURE,
    "Société et histoire": SpawnType.CULTURE,
    "Sport et plein air": SpawnType.SPORT,
    "Bien-être": SpawnType.SPORT,
    "Jardinage": SpawnType.NATURE,
    "Jeux": SpawnType.SOCIAL,
    "Langues": SpawnType.SOCIAL,
    "Fête et marché": SpawnType.SOCIAL,
}

# Categories that are not experiences you go and "catch": civic meetings, support groups, tech help.
EXCLUDED_CATEGORIES = frozenset(
    {
        "Conseil et comité",
        "Consultation publique",
        "Assemblée publique",
        "Rencontre avec personne élue",
        "Soutien et échange",
        "Informatique",
    }
)

ONLINE = "En ligne"
OUTDOOR = "À l'extérieur"
FREE = "Gratuit"

# Generous box around Montréal. Catches rows with a missing minus sign on the longitude
# (which land in Kazakhstan) and rows where latitude and longitude are the same number.
MONTREAL_BBOX = {"lat": (45.3, 45.8), "lng": (-74.1, -73.4)}

OptionalText = Annotated[str | None, BeforeValidator(blank_to_none)]
OptionalFloat = Annotated[float | None, BeforeValidator(blank_to_none)]
RequiredText = Annotated[str, BeforeValidator(blank_to_none)]


class MontrealEventRow(BaseModel):
    """One row of the GeoJSON `properties`, validated. Unknown columns are ignored."""

    model_config = ConfigDict(extra="ignore", frozen=True)

    url_fiche: RequiredText
    titre: RequiredText
    description: OptionalText = None
    date_debut: date
    date_fin: date
    type_evenement: OptionalText = None
    public_cible: OptionalText = None
    emplacement: OptionalText = None
    cout: OptionalText = None
    arrondissement: OptionalText = None
    titre_adresse: OptionalText = None
    adresse_principale: OptionalText = None
    code_postal: OptionalText = None
    lat: OptionalFloat = None
    long: OptionalFloat = None


def _inside_montreal(lat: float, lng: float) -> bool:
    (lat_min, lat_max), (lng_min, lng_max) = MONTREAL_BBOX["lat"], MONTREAL_BBOX["lng"]
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max


def _address(row: MontrealEventRow) -> str | None:
    parts = [p for p in (row.adresse_principale, row.code_postal) if p]
    return ", ".join(parts) or None


def _describe_validation_error(error: ValidationError) -> str:
    first = error.errors()[0]
    field = ".".join(str(part) for part in first["loc"])
    return f"invalid {field}: {first['msg']}"


class MontrealEventsSource(EventSource):
    info: ClassVar[SourceInfo] = SourceInfo(
        slug="montreal-events",
        name="Ville de Montréal: Événements publics",
        url="https://donnees.montreal.ca/dataset/evenements-publics",
        license="CC BY 4.0",
    )

    def __init__(self, loader: Callable[[], Any] | None = None) -> None:
        """`loader` returns the parsed GeoJSON. Defaults to downloading it; tests and the
        `--file` CLI option pass a function that reads a local file instead."""
        self._load = loader or (lambda: download_json(GEOJSON_URL))

    def fetch(self) -> list[Record]:
        collection = self._load()
        if collection.get("type") != "FeatureCollection":
            raise ValueError("expected a GeoJSON FeatureCollection")
        # Properties already contain lat/long (identical to the geometry in the real data).
        return [json_safe(feature.get("properties") or {}) for feature in collection["features"]]

    def parse(self, record: Record, today: date) -> ParseResult:
        external_id = blank_to_none(record.get("url_fiche"))
        try:
            row = MontrealEventRow.model_validate(record)
        except ValidationError as error:
            return Rejected(_describe_validation_error(error), external_id)

        # Out of scope first: these are filtered on purpose, whatever the quality of the rest.
        if row.emplacement == ONLINE:
            return Skipped("online event")
        if row.date_fin < today:
            return Skipped("already ended")
        if row.type_evenement in EXCLUDED_CATEGORIES:
            return Skipped(f"not an in-person experience: {row.type_evenement}")

        # Then data quality.
        if row.type_evenement is None:
            return Rejected("missing category", row.url_fiche)
        spawn_type = CATEGORY_TO_TYPE.get(row.type_evenement)
        if spawn_type is None:
            return Rejected(f"unmapped category: {row.type_evenement}", row.url_fiche)
        if row.date_fin < row.date_debut:
            return Rejected("ends before it starts", row.url_fiche)
        if row.lat is None or row.long is None:
            return Rejected("no coordinates", row.url_fiche)
        if not _inside_montreal(row.lat, row.long):
            return Rejected(f"coordinates outside Montréal ({row.lat}, {row.long})", row.url_fiche)

        starts_at, ends_at = all_day_window(row.date_debut, row.date_fin)
        is_outdoor = row.emplacement == OUTDOOR
        return Accepted(
            NormalizedSpawn(
                external_id=row.url_fiche,
                title=row.titre,
                description=row.description,
                type=spawn_type,
                rarity=rarity_for(spawn_type, row.date_debut, row.date_fin, is_outdoor=is_outdoor),
                lat=row.lat,
                lng=row.long,
                starts_at=starts_at,
                ends_at=ends_at,
                all_day=True,
                place_name=row.titre_adresse,
                address=_address(row),
                borough=row.arrondissement,
                audience=row.public_cible,
                is_free=None if row.cout is None else row.cout == FREE,
                is_outdoor=is_outdoor,
                url=row.url_fiche,
                raw=record,
            )
        )
