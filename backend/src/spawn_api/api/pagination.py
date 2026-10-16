"""Keyset ("cursor") pagination for results ordered by distance.

Instead of OFFSET (which gets slower page after page and skips or repeats rows when data changes
between requests), the cursor remembers the last row returned: its distance and id. The next page
asks for rows strictly after that point in the (distance, id) order.
"""

import base64
import binascii
import json
import uuid
from dataclasses import dataclass


class InvalidCursorError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class DistanceCursor:
    distance_m: float
    id: uuid.UUID

    def encode(self) -> str:
        raw = json.dumps({"d": self.distance_m, "id": str(self.id)}).encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")

    @classmethod
    def decode(cls, token: str) -> "DistanceCursor":
        try:
            padded = token + "=" * (-len(token) % 4)
            data = json.loads(base64.urlsafe_b64decode(padded))
            return cls(distance_m=float(data["d"]), id=uuid.UUID(data["id"]))
        except (binascii.Error, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
            raise InvalidCursorError("invalid cursor") from error
