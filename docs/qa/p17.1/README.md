# P17.1 MVP integration and smoke evidence

Date: 2026-11-25

Repository baseline: `8018b9fc20c31ec6c6244aa09ea961e4356d1c00`
Environment: deterministic Jest fixtures; no production or staging writes

This folder records the P17.1 route inventory, journey smoke coverage, contract findings and release-blocker evidence. `PASS` means the stated behavior is covered by source-backed automated tests or an existing verified implementation. It does not mean that the behavior was tested on a physical device, with live push delivery, or against production.

The temporary main-only workflow was followed. `docs/decisions/DECISIONS.md` was requested by the phase instructions but is not present in this repository; its absence is recorded rather than inferred.

Files:

- [MVP screen coverage matrix](./screen-coverage.md)
- [Seven-journey smoke matrix](./journey-matrix.md)
- [Contract discrepancies and release blockers](./blockers.md)
- [Validation results and outstanding checks](./validation.md)
