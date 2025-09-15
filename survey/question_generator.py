from __future__ import annotations

import random
from dataclasses import dataclass, asdict
from typing import Iterable, List, Optional, Sequence


DEFAULT_MEANS: Sequence[str] = (
    "walk",
    "bicycle",
    "car",
    # "train",
    # "other personal transport",
    # "other public transport",
)

DEFAULT_UNITS: Sequence[str] = ("minutes", "hours", "days")


@dataclass
class Question:
    id: int
    means_of_transportation: str
    base_time_value: int
    base_time_unit: str

    @property
    def prompt(self) -> str:
        # Format minutes > 60 as X hours Y minutes
        if self.base_time_unit == "minutes" and self.base_time_value > 60:
            hours = self.base_time_value // 60
            minutes = self.base_time_value % 60
            base_str = f"{hours} hours {minutes} minutes"
        elif self.base_time_unit == "hours" and self.base_time_value > 24:
            days = self.base_time_value // 24
            hours = self.base_time_value % 24
            if hours == 0:
                base_str = f"{days} days"
            else:
                base_str = f"{days} days {hours} hours"
        else:
            base_str = f"{self.base_time_value} {self.base_time_unit}"
        return (
            f"You travel from point A to point B by {self.means_of_transportation}, "
            f"and it takes {base_str}. "
            f"How much extra time to visit a mid-point C would you still consider as 'along the way'?"
        )

    def to_dict(self) -> dict:
        d = asdict(self)
        d["prompt"] = self.prompt
        return d


@dataclass
class GenerationOptions:
    means: Sequence[str] = DEFAULT_MEANS
    units: Sequence[str] = DEFAULT_UNITS
    # Per-unit ranges (inclusive)
    minutes_range: tuple[int, int] = (5, 180)
    hours_range: tuple[int, int] = (1, 12)
    days_range: tuple[int, int] = (1, 3)


def _sample_time_value(unit: str, rng: random.Random, opts: GenerationOptions) -> int:
    if unit == "minutes":
        lo, hi = opts.minutes_range
        if hi <= 20:
            return rng.randint(lo, hi)
        allowed: list[int] = []
        if lo <= 20:
            allowed.extend(list(range(lo, min(20, hi) + 1)))
            start = 21
        else:
            start = lo
        if hi > 20:
            # align to next multiple of 5
            if start % 5 != 0:
                start = start + (5 - (start % 5))
            if start <= hi:
                allowed.extend(list(range(start, hi + 1, 5)))
        return rng.choice(allowed)
    elif unit == "hours":
        lo, hi = opts.hours_range
    elif unit == "days":
        lo, hi = opts.days_range
    else:
        raise ValueError(f"Unsupported unit: {unit}")
    return rng.randint(lo, hi)


def generate_questions(
    count: int,
    *,
    seed: Optional[int] = None,
    options: Optional[GenerationOptions] = None,
) -> List[Question]:
    rng = random.Random(seed)
    opts = options or GenerationOptions()

    questions: List[Question] = []
    for i in range(1, count + 1):
        unit = rng.choice(list(opts.units))
        means = rng.choice(list(opts.means))
        value = _sample_time_value(unit, rng, opts)
        questions.append(
            Question(
                id=i,
                means_of_transportation=means,
                base_time_value=value,
                base_time_unit=unit,
            )
        )
    return questions


