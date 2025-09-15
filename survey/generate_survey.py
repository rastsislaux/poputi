from __future__ import annotations

import argparse
from pathlib import Path
from typing import Literal

from .parser import parse_survey_from_markdown
from .writers import JsonWriter, MarkdownWriter, Writer


def get_writer(fmt: Literal["json", "md"]) -> Writer:
    if fmt == "json":
        return JsonWriter()
    if fmt == "md":
        return MarkdownWriter()
    raise ValueError(f"Unsupported format: {fmt}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate survey from doc/definition.md")
    parser.add_argument("--definition", default=str(Path("doc") / "definition.md"), help="Path to definition.md")
    parser.add_argument("--out", required=False, help="Output file path. If omitted, uses survey/survey.<ext>")
    parser.add_argument("--format", choices=["json", "md"], default="json", help="Output format")
    args = parser.parse_args()

    definition_path = Path(args.definition)
    spec = parse_survey_from_markdown(definition_path)

    default_name = f"survey.{args.format}"
    out_path = Path(args.out) if args.out else Path("survey") / default_name

    writer = get_writer(args.format)
    writer.write(spec, out_path)
    print(f"Wrote {args.format.upper()} survey to: {out_path}")


if __name__ == "__main__":
    main()


