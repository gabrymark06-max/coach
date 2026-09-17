"""Caricamento delle regole (YAML versionato) e del catalogo esercizi."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import yaml

from app.engine.models import ExerciseSpec, Rule

KNOWLEDGE_DIR = Path(__file__).resolve().parents[1] / "knowledge"

# Istruzioni nostre per i tre esercizi senza record nel dataset.
_OWN_INSTRUCTIONS: dict[str, list[str]] = {
    "bodyweight_squat": [
        "Piedi alla larghezza delle spalle, punte leggermente in fuori.",
        "Scendi piegando anche e ginocchia insieme, come per sederti, con il petto alto.",
        "Arriva con le cosce almeno parallele al pavimento, poi risali spingendo con tutto il piede.",
    ],
    "pike_push_up": [
        "Dalla posizione dei piegamenti porta i fianchi in alto, corpo a V rovesciata.",
        "Piega i gomiti e porta la testa verso il pavimento, davanti alle mani.",
        "Spingi fino a distendere le braccia. Più i piedi sono vicini alle mani, più lavorano le spalle.",
    ],
    "plank": [
        "Avambracci a terra, gomiti sotto le spalle, piedi uniti.",
        "Corpo in linea dalla testa ai talloni: addome e glutei attivi, sguardo a terra.",
        "Tieni la posizione per il tempo indicato respirando normalmente.",
    ],
}


def rules_path() -> Path:
    return KNOWLEDGE_DIR / "rules.yaml"


def citations_path() -> Path:
    return KNOWLEDGE_DIR / "citations.yaml"


def exercises_path() -> Path:
    return KNOWLEDGE_DIR / "exercises.yaml"


def _to_rule(d: dict) -> Rule:
    updated = d["updated_at"]
    if isinstance(updated, str):
        updated = date.fromisoformat(updated)
    return Rule(
        id=d["id"],
        version=int(d.get("version", 1)),
        governs=d["governs"],
        applies_to=dict(d.get("applies_to") or {}),
        value=dict(d.get("value") or {}),
        grade=d.get("grade"),
        citations=list(d.get("citations") or []),
        title_it=d["title_it"],
        summary_it=d["summary_it"],
        not_says_it=d["not_says_it"],
        is_own_note=bool(d.get("is_own_note", False)),
        rationale_it=d.get("rationale_it"),
        updated_at=updated,
    )


def load_rules(path: Path | None = None) -> dict[str, Rule]:
    """Ritorna un dict mutabile id -> Rule (i test cambiano un valore per vedere il piano cambiare)."""
    raw = yaml.safe_load((path or rules_path()).read_text(encoding="utf-8"))
    rules: dict[str, Rule] = {}
    for d in raw:
        r = _to_rule(d)
        if r.id in rules:
            raise ValueError(f"regola duplicata: {r.id}")
        if r.is_own_note and not r.rationale_it:
            raise ValueError(f"nota nostra senza rationale_it: {r.id}")
        if not r.is_own_note and not r.citations:
            raise ValueError(f"regola senza citazioni e non marcata come nostra: {r.id}")
        if len(r.title_it) > 80:
            raise ValueError(f"title_it troppo lungo: {r.id}")
        rules[r.id] = r
    return rules


def rules_from_rows(rows) -> dict[str, Rule]:
    """Dalle righe della tabella `rules` (stessa forma del YAML)."""
    out: dict[str, Rule] = {}
    for row in rows:
        out[row.id] = Rule(
            id=row.id,
            version=row.version,
            governs=row.governs,
            applies_to=dict(row.applies_to or {}),
            value=dict(row.value or {}),
            grade=row.grade,
            citations=list(row.citation_ids or []),
            title_it=row.title_it,
            summary_it=row.summary_it,
            not_says_it=row.not_says_it,
            is_own_note=row.is_own_note,
            rationale_it=row.rationale_it,
            updated_at=row.updated_at,
        )
    return out


def load_citations(path: Path | None = None) -> list[dict]:
    return yaml.safe_load((path or citations_path()).read_text(encoding="utf-8"))


def load_catalog(path: Path | None = None) -> list[ExerciseSpec]:
    raw = yaml.safe_load((path or exercises_path()).read_text(encoding="utf-8"))
    vendored = json.loads((KNOWLEDGE_DIR / "exercises_dataset_it.json").read_text(encoding="utf-8"))["items"]
    out: list[ExerciseSpec] = []
    for d in raw:
        ds_id = d.get("ds_id")
        steps = vendored.get(ds_id, {}).get("steps_it", []) if ds_id else _OWN_INSTRUCTIONS.get(d["id"], [])
        out.append(
            ExerciseSpec(
                id=d["id"],
                name_it=d["name_it"],
                name_en=d["name_en"],
                pattern=d["pattern"],
                primary_muscle=d["primary_muscle"],
                secondary=list(d.get("secondary") or []),
                equipment=d["equipment"],
                mechanic=d["mechanic"],
                spinal_load=d.get("spinal_load", "low"),
                min_tier=d.get("min_tier", "beginner"),
                requires=d.get("requires"),
                instructions_it=list(steps),
                ds_id=ds_id,
            )
        )
    return out


def catalog_from_rows(rows) -> list[ExerciseSpec]:
    return [
        ExerciseSpec(
            id=r.id,
            name_it=r.name_it,
            name_en=r.name_en,
            pattern=r.pattern,
            primary_muscle=r.primary_muscle,
            secondary=list(r.secondary_muscles or []),
            equipment=r.equipment,
            mechanic=r.mechanic,
            spinal_load=r.spinal_load,
            min_tier=r.min_tier,
            requires=r.requires,
            instructions_it=list(r.instructions_it or []),
            ds_id=None,
        )
        for r in rows
    ]
