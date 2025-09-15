from __future__ import annotations

import argparse
from pathlib import Path
from typing import Literal

from .question_generator import generate_questions
from .question_writers import QuestionJsonWriter, QuestionMarkdownWriter, QuestionWriter


def get_writer(fmt: Literal["json", "md"]) -> QuestionWriter:
    if fmt == "json":
        return QuestionJsonWriter()
    if fmt == "md":
        return QuestionMarkdownWriter()
    raise ValueError(f"Unsupported format: {fmt}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate N survey questions")
    parser.add_argument("count", type=int, help="Number of questions to generate")
    parser.add_argument("--format", choices=["json", "md"], default="json")
    parser.add_argument("--out", help="Output file path; defaults to survey/questions.<ext>")
    parser.add_argument("--seed", type=int, help="Random seed for reproducibility")
    args = parser.parse_args()

    questions = generate_questions(args.count, seed=args.seed)
    default_name = f"questions.{args.format}"
    out_path = Path(args.out) if args.out else Path("survey") / default_name

    writer = get_writer(args.format)
    writer.write(questions, out_path)
    print(f"Wrote {args.count} questions to: {out_path}")


if __name__ == "__main__":
    main()


