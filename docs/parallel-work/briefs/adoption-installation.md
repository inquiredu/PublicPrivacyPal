# DOC-03 — Fresh clone and truthful local startup

Read AGENTS.md, HANDOFF.md, the original independent-installation brief, current workboard,
local-development, permissions, backup-recovery and installation-readiness. Your GitHub clone starts
at the accepted 2f3709f checkpoint; do not copy any private config, accounts or dependency directory.
The exact exclusive allowlist is in adoptionWave.assignments. Do not delegate or push.

Install pinned dependencies with Node 24 into your own directory. Rehearse local:init twice and
record observed prerequisites. Before any emulator, API or browser work, obtain the coordinator's
resource reservation. Use config/second-district.example.json for a fresh synthetic installation.
When assigned the runtime, start, bootstrap, verify repeat bootstrap leaves state unchanged,
exercise local sign-in/setup, save and verify an archive, stop and restore without bootstrap.
Do not use or stop the saved Maple preview. The coordinator manages its preservation.

Implement the observed startup diagnostic fix: distinguish EADDRINUSE from EACCES/EPERM and other
bind failures. Keep the existing loopback ports and fresh-session refusal. Factor only the port
probe/diagnostic into scripts/local-ports.ts, with meaningful injected-error tests; preserve process
lifecycle, environment and restore behavior. Never claim a port is occupied for every socket error.
Do not add dependencies or alter config/auth/rules. Update onboarding with observed clean-clone
results and exact untested limits. This agent-operated trial is not an outside-person adoption pilot.

Report source files, checks, limitations and any needed coordinator changes in DOC-03.md.
