# RC2 explicit staging plan

Run only after the exact RC2 authorization phrase is received. The script stages 56 explicit paths, never uses `git add .`, verifies the exact staged path set, verifies each staged payload overlay blob against the approved working payload, runs the staged whitespace check, displays the staged summary, and stops before commit.
