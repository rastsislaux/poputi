from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, List

from .parser import SurveySpec, SurveyField


class Writer(ABC):
    @abstractmethod
    def write(self, spec: SurveySpec, output_path: Path) -> None:
        """Serialize the survey specification to output_path."""
        raise NotImplementedError


class JsonWriter(Writer):
    def write(self, spec: SurveySpec, output_path: Path) -> None:
        payload: Dict[str, Any] = spec.to_dict()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


class MarkdownWriter(Writer):
    def write(self, spec: SurveySpec, output_path: Path) -> None:
        md_lines: List[str] = []
        md_lines.append("## Survey — Generated")

        md_lines.append("")
        md_lines.append("### Respondent metadata")
        md_lines.extend(self._table([
            ("Field", "Type", "Notes"),
            *[(f.name, f.type, f.notes) for f in spec.respondent_metadata],
        ]))

        md_lines.append("")
        md_lines.append("### Trip scenario and judgment")
        md_lines.extend(self._table([
            ("Field", "Type", "Notes"),
            *[(f.name, f.type, f.notes) for f in spec.trip_scenario],
        ]))

        if spec.wording_example:
            md_lines.append("")
            md_lines.append("### Wording example")
            md_lines.append("")
            md_lines.append(spec.wording_example)

        content = "\n".join(md_lines) + "\n"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content, encoding="utf-8")

    @staticmethod
    def _table(rows: List[tuple]) -> List[str]:
        if not rows:
            return []
        header = rows[0]
        lines = [
            f"| {header[0]} | {header[1]} | {header[2]} |",
            "| --- | --- | --- |",
        ]
        for r in rows[1:]:
            lines.append(f"| {r[0]} | {r[1]} | {r[2]} |")
        return lines


