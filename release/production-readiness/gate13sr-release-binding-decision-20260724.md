# Gate 13S-R release-binding decision

Classification: **B — minimal RC3 required**.

RC2 runtime code, migrations and database behavior remain valid, and staging needs no schema remediation. However, the obsolete fingerprint is embedded in the committed baseline V3 metadata/manifest and release-control evidence, while the canonical tool and adversarial tests are not in RC2. Tag `v1.0.0-rc.2` remains immutable. A minimal `1.0.0-rc.3` must bind the canonical hash without changing migrations or product behavior.
