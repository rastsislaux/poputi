from __future__ import annotations

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Iterable

from .question_generator import Question


class QuestionWriter(ABC):
    @abstractmethod
    def write(self, questions: Iterable[Question], output_path: Path) -> None:
        raise NotImplementedError


class QuestionJsonWriter(QuestionWriter):
    def write(self, questions: Iterable[Question], output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        payload = [q.to_dict() for q in questions]
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


class QuestionMarkdownWriter(QuestionWriter):
    def write(self, questions: Iterable[Question], output_path: Path) -> None:
        lines = ["## Survey Questions", ""]
        for q in questions:
            lines.append(f"### Q{q.id}")
            lines.append("")
            lines.append(q.prompt)
            lines.append("")
            lines.append("Answer: acceptable extra time (in the same units as the prompt)")
            lines.append("")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


