# Architecture

The vertical slice uses Phaser for the live workstation and ordinary DOM only for menus. Definitions in `src/data/content.ts` are independent from rendering. Pure workflow, scoring, seeded-random, performance and generation rules live under `src/core`; scenes consume those rules, while `src/services` owns persistence/platform integrations.

Future eras add definitions rather than scene conditionals. Maps, station behavior, customer generation and upgrades should each gain a typed registry. IndexedDB records carry `schemaVersion`; all later readers must migrate older records rather than mutate schemas ad hoc. See `IMPLEMENTATION_PLAN.md` for the complete v1 stages.
