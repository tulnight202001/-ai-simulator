# Data schema

- `ModelDefinition`: identity, original appearance color, strengths/trade-off, speed/stability/multitask and five resource capacities.
- `StationDefinition`: station identity, output presentation, resource affinity, processing cost/time and map position.
- `RecipeDefinition`: ordered station IDs, reward and patience. Repeated IDs will represent repeated processing.
- Level: identity, era, duration, map/station IDs, recipe/customer pools, goals, star thresholds and capped rewards.
- `CareerSave`: version, slot identity, reproducibility seed, selected model and progression summary. Full v1 will extend it with RNG state, abilities/caps, era/stars, long-term values, equipment, agents, upgrades, endless state and career report.

All balance defaults are in data modules, never embedded in UI markup.
