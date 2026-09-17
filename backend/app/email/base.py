"""Interfaccia del provider email. Il job e l'auth parlano solo con questa."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class OutgoingEmail:
    to: str
    subject: str
    text: str
    kind: str
    meta: dict[str, Any] = field(default_factory=dict)  # mai spedito: serve ai test (token) e al log


class Mailer(Protocol):
    async def send(self, email: OutgoingEmail) -> str | None:
        """Ritorna l'id del provider, o None."""
        ...
