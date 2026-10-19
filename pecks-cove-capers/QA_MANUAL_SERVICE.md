# Manual service update · build and QA handoff

- Scope: isolated `feature/pecks-cove-manual-service-20261018` branch only; ECHOFORM, Project-hail and VQ engine unchanged.
- Browser/Chromium: locally checked all 10 selectable roles, D-pad/keyboard movement, no click-to-move, manually operated marked tasks, guest arrival/orders, persistent unserved diners, food pickup/serve, persistent ghost chores; landscape and portrait captures made without runtime console exceptions.
- Visual reference: PlateUp! serves as a general benchmark for readable top-down framing, not source for art or code. Original art and logic only.
- Android: compile Java 17 SDK35, manual emulator smoke on API29. Android pass and screenshots are not assumed unless the workflow conclusion and artifact say so.
- Risks: HTML Canvas drawing/interaction may vary with Android System WebView version; visual screenshot review is necessary after CI.
- VQ shared policy: preserve source, old functioning builds, keep only short-lived generated debug artifacts and avoid unbounded emulator work.
