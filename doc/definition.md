## Poputi — Definition

### Purpose
Poputi helps users determine whether a given point C lies along the way from point A to point B.

### Main use case
When two or more people are debating whether point C is along the way from point A to point B, they can use Poputi to obtain a statistics-based answer to their question.

### Decision strategies
| Strategy | Basis | Summary |
| --- | --- | --- |
| Objective | Population survey | Uses a statistically significant sample to produce the most objective threshold. |
| Hybrid | Survey + parties’ inputs | Blends population threshold with parties’ preferences via a convex combination. |
| Subjective | Parties’ inputs only | Ignores survey; uses only the participants’ preferences. |

### Scope notes
This document focuses on the definition, decision strategies, and the data the survey collects. Detailed instrumentation and sampling methodology will be refined later.

## Decision strategy specifications

#### 1) Objective

Input and fields per response are age, sex, education, country, distance, and max_delta. Age, sex, education, and country are collected for future analysis but are not used initially. In this version, distance (x) denotes travel time from departure to destination (e.g., minutes or hours). The acceptable deviation max_delta is denoted δ<sub>acc</sub> and represents the maximal extra travel time still considered “along the way”. A scatter plot can be drawn with travel time x on the horizontal axis and δ<sub>acc</sub> on the vertical axis.

The goal is to approximate a threshold function f(x) mapping base travel time to acceptable extra travel time. Reasonable estimators include conditional quantile smoothing (for example, f<sub>p</sub>(x) = Q<sub>p</sub>(δ<sub>acc</sub> | x) at a chosen quantile p), monotone splines, kernel regression, isotonic regression to enforce non-decreasing behavior, LOESS/LOWESS, or piecewise-linear fits. Recommended constraints are f(0) = 0 and f non-decreasing in x.

Decision rule: for a case with base travel time x* and proposed extra time δ*, return “along the way” when δ* ≤ f(x*); otherwise return “not along the way”.

#### 2) Hybrid

Each interested party completes the same survey to produce an individual acceptable‑deviation function g<sub>k</sub>(x), estimated with the same family of estimators as f. The hybrid threshold is a convex blend of the population function and the participants’ aggregate: h(x) = (1 − α) · f(x) + α · A({g<sub>k</sub>(x)}), with α in [0, 1] and A an aggregator such as a simple or weighted mean, or a quantile across participants. The decision is identical in form to the objective rule: for base travel time x* and extra time δ*, return “along the way” if δ* ≤ h(x*), else “not along the way”. Defaults to be finalized include p for f<sub>p</sub>, α, the choice of aggregator A, and optional participant weights w<sub>k</sub>.

#### 3) Subjective

The subjective approach ignores f and uses only the interested parties’ functions. Define an aggregate threshold s(x) = A({g<sub>k</sub>(x)}). For base travel time x* and extra time δ*, return “along the way” if δ* ≤ s(x*), otherwise “not along the way”.

Edge cases: if no participant inputs are available, the Hybrid reduces to the Objective case (α = 0), while the Subjective case is undefined and should prompt for inputs. If only a single participant responds, A degenerates to that participant’s g<sub>k</sub>.

Implementation parameters to be finalized include the quantile level p for the objective fit f<sub>p</sub>, the estimator/smoother and its regularization (for example spline degree, LOESS span, monotonicity), the hybrid weight α and optional participant weights w<sub>k</sub>, and the units (we use time units by default).

### Glossary
| Term | Definition |
| --- | --- |
| base travel time (x) | Time from departure to destination in chosen units (minutes/hours). |
| extra time (δ) | Additional time off the base (detour) in the same units. |
| acceptable extra time (δ<sub>acc</sub>) | Respondent-declared maximum extra time still considered “along the way”. |
| objective function (f) | Population-based threshold mapping base time to acceptable extra time. |
| participant function (g<sub>k</sub>) | Threshold estimated from participant k’s survey answers. |
| hybrid function (h) | Convex blend of f and an aggregation of {g<sub>k</sub>}. |
| subjective function (s) | Aggregation of {g<sub>k</sub>} only, without f. |
| aggregator (A) | Rule to combine multiple functions (e.g., mean, weighted mean, quantile). |
- route settings: Parameters defining how distance/deviation are computed (e.g., metric, routing profile).

### Parameters
| Parameter | Meaning | Range/Type | Default (TBD) |
| --- | --- | --- | --- |
| p | Quantile for objective fit f<sub>p</sub> | [0,1] | 0.5 (median) |
| Smoother | Estimator for f, g<sub>k</sub> | enum | LOESS or monotone spline |
| Monotonicity | Enforce f′(x) ≥ 0 | boolean | true |
| α | Hybrid blend weight | [0,1] | 0.3 |
| w<sub>k</sub> | Participant weights | non-negative, sum to 1 | equal weights |
| Units | Base and extra travel time units | enum | minutes |
| Routing profile | Road/foot/cycling assumptions | enum | driving |

## Survey

The survey collects respondent metadata and scenario judgments needed to estimate f(x) and, when applicable, participant-specific functions g<sub>k</sub>(x). We collect some attributes for future analyses even if they are not used in the current decision rules.

Respondent metadata:

| Field | Type | Notes |
| --- | --- | --- |
| Age | integer or range | Collected for future analysis; not used in v1 |
| Sex | categorical | Collected for future analysis; not used in v1 |
| Education | categorical | Collected for future analysis; not used in v1 |
| Country | categorical | Collected for future analysis; not used in v1 |

Trip scenario and judgment:

| Field | Type | Notes |
| --- | --- | --- |
| Means of transportation | categorical | walk, bicycle, car, train, other personal transport, other public transport |
| Base travel time (x) | numeric (time) | minutes/hours/days; unit shown to respondent |
| Acceptable extra time (δ<sub>acc</sub>) | numeric (time) | respondent’s threshold to still consider “along the way” |

Wording example shown to respondents:

“You travel from point A to point B by [means of transportation], and it takes X [minutes/hours/days]. How much extra time to visit a mid-point C would you still consider as ‘along the way’?”

### Method used (current analysis)

- See the notebook `analysis/survey_analysis.ipynb`.
- Data pipeline: CSV export → drop duplicate (`user_id`, `question_id`) keeping latest → normalize base and extra times to minutes.
- Visualization: scatter plot of base minutes vs acceptable extra minutes.
- Approximation: binned medians in x followed by isotonic regression (monotone increasing) to estimate f(x).
- The fitted curve is exported to `analysis/fitted_threshold.csv` for downstream use.

