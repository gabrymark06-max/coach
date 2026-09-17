from __future__ import annotations

from app.email.base import OutgoingEmail


class FakeMailer:
    """Registra le email in memoria. Usato in test e in sviluppo senza chiave."""

    def __init__(self) -> None:
        self.sent: list[OutgoingEmail] = []

    async def send(self, email: OutgoingEmail) -> str | None:
        self.sent.append(email)
        return f"fake_{len(self.sent)}"
