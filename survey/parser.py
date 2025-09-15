from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Dict, Optional, Tuple


@dataclass
class SurveyField:
    name: str
    type: str
    notes: str
    options: Optional[List[str]] = None


@dataclass
class SurveySpec:
    respondent_metadata: List[SurveyField]
    trip_scenario: List[SurveyField]
    wording_example: Optional[str]

    def to_dict(self) -> Dict:
        return {
            "respondent_metadata": [asdict(f) for f in self.respondent_metadata],
            "trip_scenario": [asdict(f) for f in self.trip_scenario],
            "wording_example": self.wording_example,
        }


def _find_section(lines: List[str], title: str) -> Optional[int]:
    title_line = title.strip()
    for idx, line in enumerate(lines):
        if line.strip() == title_line:
            return idx
    return None


def _extract_table(lines: List[str], start_idx: int) -> Tuple[List[Dict[str, str]], int]:
    """
    Extract a GitHub-flavored Markdown table starting at or after start_idx.
    Returns (rows, end_idx) where end_idx is the index after the table.
    """
    # Move to first table header line (starts with '|')
    i = start_idx
    while i < len(lines) and not lines[i].strip().startswith("|"):
        i += 1
    if i >= len(lines):
        return ([], i)

    header_line = lines[i].rstrip("\n")
    separator_line = lines[i + 1].rstrip("\n") if i + 1 < len(lines) else ""
    if "|" not in header_line or "---" not in separator_line:
        return ([], i)

    headers = [h.strip() for h in header_line.strip().strip("|").split("|")]

    rows: List[Dict[str, str]] = []
    i += 2
    while i < len(lines):
        line = lines[i].rstrip("\n")
        if not line.strip().startswith("|"):
            break
        cols = [c.strip() for c in line.strip().strip("|").split("|")]
        # Pad/truncate to header length
        if len(cols) < len(headers):
            cols += [""] * (len(headers) - len(cols))
        if len(cols) > len(headers):
            cols = cols[: len(headers)]
        rows.append(dict(zip(headers, cols)))
        i += 1
    return rows, i


def _extract_options_from_notes(notes: str) -> Optional[List[str]]:
    # Heuristic: if notes contains a comma-separated list of short items, treat as options
    parts = [p.strip() for p in notes.split(",")]
    parts = [p for p in parts if p]
    if len(parts) >= 2 and all(len(p) <= 50 for p in parts):
        return parts
    return None


def parse_survey_from_markdown(markdown_path: Path) -> SurveySpec:
    text = markdown_path.read_text(encoding="utf-8")
    lines = text.splitlines()

    survey_header_idx = _find_section(lines, "## Survey")
    if survey_header_idx is None:
        raise ValueError("Could not find '## Survey' section in definition.md")

    # Find sub-sections within Survey
    # Respondent metadata
    respondent_idx = None
    for i in range(survey_header_idx, len(lines)):
        if lines[i].strip().lower().startswith("respondent metadata"):
            respondent_idx = i
            break
    if respondent_idx is None:
        raise ValueError("Could not find 'Respondent metadata' table in Survey section")

    respondent_rows, after_resp = _extract_table(lines, respondent_idx)

    # Trip scenario and judgment
    scenario_idx = None
    for i in range(after_resp, len(lines)):
        if lines[i].strip().lower().startswith("trip scenario and judgment"):
            scenario_idx = i
            break
    if scenario_idx is None:
        raise ValueError("Could not find 'Trip scenario and judgment' table in Survey section")

    scenario_rows, after_scenario = _extract_table(lines, scenario_idx)

    # Wording example
    wording_example: Optional[str] = None
    for i in range(after_scenario, min(len(lines), after_scenario + 20)):
        if lines[i].strip().lower().startswith("wording example"):
            # Next non-empty line is the example
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                wording_example = lines[j].strip().strip('"')
            break

    def to_fields(rows: List[Dict[str, str]]) -> List[SurveyField]:
        fields: List[SurveyField] = []
        for row in rows:
            name = row.get("Field", "").strip()
            typ = row.get("Type", "").strip()
            notes = row.get("Notes", "").strip()
            options = _extract_options_from_notes(notes)
            fields.append(SurveyField(name=name, type=typ, notes=notes, options=options))
        return fields

    return SurveySpec(
        respondent_metadata=to_fields(respondent_rows),
        trip_scenario=to_fields(scenario_rows),
        wording_example=wording_example,
    )


