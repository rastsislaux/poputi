#!/usr/bin/env python3
"""
Export Firestore 'survey' answers to CSV, one row per answer, including respondent metadata.

Usage:
  1) Obtain exporter SA key JSON from OpenTofu output:
     tofu output -raw export_service_account_key_json > exporter_key.json

  2) Run:
     GOOGLE_APPLICATION_CREDENTIALS=exporter_key.json \
     python3 export/export_firestorm_csv.py --project $GCP_PROJECT_ID --out survey_export.csv

Notes:
  - Reads collection 'survey'.
  - Expects documents shaped like the app's payload, with fields:
      lang, user_id, respondent (object), answers (array of objects), submitted_at
    Each answers entry becomes a row.
"""

from __future__ import annotations

import argparse
import csv
from typing import Any, Dict, Iterable, List

from google.cloud import firestore


def iter_rows(doc: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
  respondent = doc.get("respondent") or {}
  common = {
    "doc_id": doc.get("_id") or "",
    "user_id": doc.get("user_id") or "",
    "lang": doc.get("lang") or "",
    "submitted_at": doc.get("submitted_at") or "",
    **{f"meta_{k}": v for k, v in respondent.items()},
  }
  answers = doc.get("answers") or []
  for a in answers:
    row = dict(common)
    row.update(
      {
        "question_id": a.get("question_id"),
        "means": a.get("means_of_transportation"),
        "base_time_value": a.get("base_time_value"),
        "base_time_unit": a.get("base_time_unit"),
        "acceptable_extra_time": a.get("acceptable_extra_time"),
        "acceptable_extra_time_unit": a.get("acceptable_extra_time_unit"),
      }
    )
    yield row


def main() -> None:
  parser = argparse.ArgumentParser(description="Export Firestore survey answers to CSV")
  parser.add_argument("--project", required=True, help="GCP project id")
  parser.add_argument("--out", required=True, help="Output CSV path")
  args = parser.parse_args()

  db = firestore.Client(project=args.project)
  rows: List[Dict[str, Any]] = []
  for snap in db.collection("survey").stream():
    data = snap.to_dict() or {}
    data["_id"] = snap.id
    rows.extend(iter_rows(data))

  # Collect header
  fieldnames: List[str] = []
  for r in rows:
    for k in r.keys():
      if k not in fieldnames:
        fieldnames.append(k)

  with open(args.out, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

  print(f"Wrote {len(rows)} rows to {args.out}")


if __name__ == "__main__":
  main()


