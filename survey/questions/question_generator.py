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
    # Unit selection weights (bias toward shorter trips)
    unit_weights: Optional[dict[str, float]] = None

    def __post_init__(self) -> None:
        if self.unit_weights is None:
            # Heavily favor minutes, then hours, rarely days
            self.unit_weights = {"minutes": 0.78, "hours": 0.20, "days": 0.02}


def _weighted_choice(rng: random.Random, values: list[int], weights: list[float]) -> int:
    total = sum(weights)
    if total <= 0:
        return values[-1]
    pick = rng.random() * total
    acc = 0.0
    for v, w in zip(values, weights):
        acc += w
        if pick <= acc:
            return v
    return values[-1]


def _sample_time_value(unit: str, rng: random.Random, opts: GenerationOptions) -> int:
    if unit == "minutes":
        lo, hi = opts.minutes_range
        # Generate allowed values in 5-minute steps starting at max(lo, 10)
        start = max(lo, 10)
        if start % 5 != 0:
            start += (5 - (start % 5))
        allowed = [v for v in range(start, hi + 1, 5)] or list(range(lo, hi + 1))
        # Backwards-linear weighting: higher weight for smaller minutes
        weights: list[float] = []
        for v in allowed:
            base = max(1.0, (hi + 5) - v)
            if v in (10, 15, 20, 25):
                base *= 3.5
            elif v <= 30:
                base *= 2.0
            elif v <= 60:
                base *= 1.3
            weights.append(base)
        return _weighted_choice(rng, allowed, weights)
    elif unit == "hours":
        lo, hi = opts.hours_range
        allowed = list(range(lo, hi + 1))
        weights = [max(1.0, (hi + 1) - v) for v in allowed]
        return _weighted_choice(rng, allowed, weights)
    elif unit == "days":
        lo, hi = opts.days_range
        hi = min(hi, 7)  # Global cap of 7 days
        allowed = list(range(lo, hi + 1))
        weights = [max(1.0, (hi + 1) - v) for v in allowed]
        return _weighted_choice(rng, allowed, weights)
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
        means = rng.choice(list(opts.means))

        # Available units depend on means (walk/bicycle exclude days)
        available_units: List[str] = list(opts.units)
        if means in ("walk", "bicycle"):
            available_units = [u for u in available_units if u in ("minutes", "hours")]

        # Choose unit with weights (favor minutes)
        uw = opts.unit_weights or {}
        unit_weights = [uw.get(u, 0.0) for u in available_units]
        total_w = sum(unit_weights) or 1.0
        unit_weights = [w / total_w for w in unit_weights]
        r = rng.random()
        acc = 0.0
        unit = available_units[-1]
        for u, w in zip(available_units, unit_weights):
            acc += w
            if r <= acc:
                unit = u
                break

        # Apply caps per means
        minutes_lo, minutes_hi = opts.minutes_range
        hours_lo, hours_hi = opts.hours_range
        days_lo, days_hi = opts.days_range
        days_hi = min(days_hi, 7)
        if means == "walk":
            hours_hi = min(hours_hi, 3)
            minutes_hi = min(minutes_hi, 180)
        elif means == "bicycle":
            hours_hi = min(hours_hi, 6)
            minutes_hi = min(minutes_hi, 360)

        # Sample within adjusted ranges
        local_opts = GenerationOptions(
            means=(means,),
            units=(unit,),
            minutes_range=(minutes_lo, minutes_hi),
            hours_range=(hours_lo, hours_hi),
            days_range=(days_lo, days_hi),
            unit_weights={unit: 1.0},
        )
        value = _sample_time_value(unit, rng, local_opts)
        questions.append(
            Question(
                id=i,
                means_of_transportation=means,
                base_time_value=value,
                base_time_unit=unit,
            )
        )
    return questions


