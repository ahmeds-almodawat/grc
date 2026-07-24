# Migration 187 sequencing analysis

The old preflight formed a dependency cycle: the protected mandatory-password flow needs the enforced Patch 83U runtime, while migration 187 required an already-active administrator before it installed that runtime. The correction recognizes one exact zero-session pending-rotation state, installs and attests the controls, then leaves the credential pending. It records no fabricated rotation, Edge, or access-review history.
