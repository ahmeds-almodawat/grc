# Patch 83U Run 008 proof traceability

Status: complete local preparation only. This document is not hosted-execution authorization and contains no execution result.

The canonical machine-readable matrix is `release/patch83u/patch83u-run008-proof-traceability.json`. Each of its 56 rows maps one proof-contract requirement to an exact SQL checkpoint field when applicable, a resolvable schema pointer, one exact harness identifier, one literal focused-test title, a phase, a safe failure code, and a resolvable redacted-evidence schema pointer. The contract audit must report 56/56 and 100% before a V6 freeze may be generated.

Aggregate pointers are deliberate: the freeze/Edge row binds the full freeze
and preflight objects, the initial administrator row binds the complete
Checkpoint 1 object including `admin` and `eligible_super_admin_count`, and the
two-context authorization row binds the full
`employee_contexts_before_reset` array.

| Requirement | Phase | Harness assertion | Safe failure code |
|---|---:|---|---|
| `R008_P01_STAGING_AND_PRODUCTION_BOUNDARY` | 1 | `assertStagingAndProductionBoundaryAggregate` | `PATCH83U_STAGING_AND_PRODUCTION_BOUNDARY_FAILED` |
| `R008_P01_FRONTEND_ORIGIN_EXACT` | 1 | `assertFrontendOriginExactAggregate` | `PATCH83U_FRONTEND_ORIGIN_EXACT_PROOF_FAILED` |
| `R008_P01_FREEZE_AND_EDGE_PROVENANCE_EXACT` | 1 | `assertEdgeDeploymentGate` | `PATCH83U_EXECUTION_FREEZE_HASH_MISMATCH` |
| `R008_P01_RUNTIME_AND_CONTRACTS_EXACT` | 1 | `assertRuntimeAndContractsExactAggregate` | `PATCH83U_RUNTIME_AND_CONTRACTS_EXACT_PROOF_FAILED` |
| `R008_P01_PROOF_ARTIFACT_HASHES_EXACT` | 1 | `verifyRun008ContractArtifacts` | `PATCH83U_RUN008_PROOF_CONTRACT_HASH_MISMATCH` |
| `R008_P01_TRACEABILITY_COMPLETE` | 1 | `verifyRun008ContractArtifacts` | `PATCH83U_RUN008_TRACEABILITY_INCOMPLETE` |
| `R008_P01_CONFIRMATION_AND_COUNT_CONTRACTS_FROZEN` | 1 | `assertRun008ConfirmationAndFinalSessionContracts` | `PATCH83U_RUN008_CONFIRMATION_AND_FINAL_SESSION_CONTRACTS_FAILED` |
| `R008_P01_EVIDENCE_EXCLUSIONS_ACTIVE` | 1 | `assertSecretSafeEvidence` | `PATCH83U_PROHIBITED_EVIDENCE_KEY` |
| `R008_P02_CHECKPOINT1_READ_ONLY` | 2 | `assertCheckpoint1ReadOnlyAggregate` | `PATCH83U_CHECKPOINT1_READ_ONLY_PROOF_FAILED` |
| `R008_P02_INITIAL_EMPLOYEE_STATE` | 2 | `assertInitialEmployeeStateAggregate` | `PATCH83U_INITIAL_EMPLOYEE_STATE_PROOF_FAILED` |
| `R008_P02_INITIAL_ADMIN_STATE` | 2 | `assertSoleSuperAdminCheckpoint` | `PATCH83U_SOLE_SUPER_ADMIN_CHECKPOINT_FAILED` |
| `R008_P02_FINALIZER_AND_RECOVERY_READY` | 2 | `assertFinalizerAndRecoveryReadyAggregate` | `PATCH83U_FINALIZER_AND_RECOVERY_READY_PROOF_FAILED` |
| `R008_P03_ADMIN_CONTEXTS_READY` | 3 | `assertAdminContextReadinessProof` | `PATCH83U_ADMIN_CONTEXT_READINESS_PROOF_FAILED` |
| `R008_P03_TWO_EMPLOYEE_SESSIONS` | 3 | `assertControlledEmployeeSessionSetupProof` | `PATCH83U_CONTROLLED_EMPLOYEE_SESSION_SETUP_PROOF_FAILED` |
| `R008_P03_BOTH_REFRESHES_SUCCEED` | 3 | `assertBothControlledRefreshesAggregate` | `PATCH83U_BOTH_CONTROLLED_REFRESHES_PROOF_FAILED` |
| `R008_P03_EMPLOYEE_AUTHORIZATION_PROVEN` | 3 | `assertControlledEmployeeContextProofs` | `PATCH83U_CONTROLLED_EMPLOYEE_CONTEXT_PROOF_FAILED` |
| `R008_P04_CHECKPOINT2_READ_ONLY` | 4 | `assertSqlEditorEvidenceSnapshot` | `PATCH83U_SQL_EDITOR_EVIDENCE_GATE_FAILED` |
| `R008_P04_TARGET_PRE_RESET_UNCHANGED` | 4 | `assertPreResetCheckpointAggregate` | `PATCH83U_PRE_RESET_CHECKPOINT_AGGREGATE_FAILED` |
| `R008_P04_ADMIN_AND_RUNTIME_UNCHANGED` | 4 | `assertPreResetCheckpointAggregate` | `PATCH83U_PRE_RESET_CHECKPOINT_AGGREGATE_FAILED` |
| `R008_P05_EXACT_RESET_CONFIRMATIONS` | 5 | `assertExactResetConfirmationsProof` | `PATCH83U_EXACT_RESET_CONFIRMATIONS_PROOF_FAILED` |
| `R008_P05_ONE_SHOT_RESET` | 5 | `assertOneShotResetAggregate` | `PATCH83U_ONE_SHOT_RESET_PROOF_FAILED` |
| `R008_P05_STABLE_REQUEST_CORRELATION` | 5 | `assertStableResetRequestCorrelationAggregate` | `PATCH83U_STABLE_RESET_REQUEST_CORRELATION_PROOF_FAILED` |
| `R008_P05_AMBIGUOUS_RESET_NO_RETRY` | 5 | `ResetSubmissionController` | `PATCH83U_RESET_RETRY_REFUSED` |
| `R008_P06_CHECKPOINT3_ALWAYS` | 6 | `assertCheckpoint3AlwaysAggregate` | `PATCH83U_CHECKPOINT3_ALWAYS_PROOF_FAILED` |
| `R008_P06_RESET_OUTCOME_CLASSIFIED` | 6 | `classifyPostResetCheckpoint` | `PATCH83U_RESET_OUTCOME_NOT_UNEQUIVOCAL` |
| `R008_P06_PROTECTED_STATE_FAIL_CLOSED` | 6 | `assertProtectedStateFailClosedAggregate` | `PATCH83U_PROTECTED_STATE_FAIL_CLOSED_PROOF_FAILED` |
| `R008_P07_RESET_SUCCESS_STATE_V5` | 7 | `assertPostResetSuccessAggregate` | `PATCH83U_POST_RESET_SUCCESS_AGGREGATE_FAILED` |
| `R008_P07_RESET_ZERO_SESSIONS` | 7 | `assertPostResetSuccessAggregate` | `PATCH83U_POST_RESET_SUCCESS_AGGREGATE_FAILED` |
| `R008_P07_RESET_GOVERNANCE_AND_AUDIT` | 7 | `assertPostResetSuccessAggregate` | `PATCH83U_POST_RESET_SUCCESS_AGGREGATE_FAILED` |
| `R008_P08_OLD_PASSWORD_REJECTED` | 8 | `loginRejected` | `PATCH83U_COMPLETED_REVOCATION_PROOF_INVALID` |
| `R008_P08_BOTH_REFRESH_REPLAYS_REJECTED` | 8 | `assertRejectedRefreshReplays` | `PATCH83U_REFRESH_REPLAY_REVOCATION_NOT_PROVEN` |
| `R008_P08_BOTH_STALE_CONTEXTS_DENIED` | 8 | `assertBothStaleContextsDeniedAggregate` | `PATCH83U_BOTH_STALE_CONTEXTS_DENIED_PROOF_FAILED` |
| `R008_P09_TEMPORARY_LOGIN_SUCCEEDS` | 9 | `assertTemporaryPasswordRestrictedLoginProof` | `PATCH83U_TEMPORARY_PASSWORD_RESTRICTED_LOGIN_NOT_PROVEN` |
| `R008_P09_FORCED_CHANGE_ONLY` | 9 | `assertTemporaryPasswordRestrictedLoginProof` | `PATCH83U_TEMPORARY_PASSWORD_RESTRICTED_LOGIN_NOT_PROVEN` |
| `R008_P10_CHECKPOINT4_READ_ONLY` | 10 | `assertSqlEditorEvidenceSnapshot` | `PATCH83U_SQL_EDITOR_EVIDENCE_GATE_FAILED` |
| `R008_P10_PRE_CHANGE_STATE_V5_WITH_TEMP_SESSION` | 10 | `assertBeforeRequiredPasswordChangeAggregate` | `PATCH83U_BEFORE_PASSWORD_CHANGE_AGGREGATE_FAILED` |
| `R008_P11_REQUIRED_CHANGE_ACTION_EXACT` | 11 | `inspectRequiredPasswordChangeEnvelope` | `PATCH83U_PASSWORD_CHANGE_REQUEST_CONTRACT_REFUSED` |
| `R008_P11_SECRET_AND_POLICY_CONTROLS` | 11 | `assertSecretAndPolicyControlsAggregate` | `PATCH83U_SECRET_AND_POLICY_CONTROLS_PROOF_FAILED` |
| `R008_P11_GLOBAL_SIGNOUT_AND_FINALIZER` | 11 | `assertPasswordChangeCompletionProof` | `PATCH83U_PASSWORD_CHANGE_COMPLETION_PROOF_FAILED` |
| `R008_P11_NO_AUTO_RECOVERY_ACTION` | 11 | `operatorGuidanceForState` | `PATCH83U_PASSWORD_CHANGE_SUBMISSION_CONTRACT_INVALID` |
| `R008_P12_CHECKPOINT5_READ_ONLY` | 12 | `assertSqlEditorEvidenceSnapshot` | `PATCH83U_SQL_EDITOR_EVIDENCE_GATE_FAILED` |
| `R008_P12_FINAL_ACTIVE_V6_ZERO` | 12 | `assertAfterPasswordChangeAggregate` | `PATCH83U_AFTER_PASSWORD_CHANGE_AGGREGATE_FAILED` |
| `R008_P12_PASSWORD_CHANGED_AT_SET` | 12 | `assertPasswordChangeFinalizationProof` | `PATCH83U_PASSWORD_CHANGED_AT_SET_NOT_PROVEN` |
| `R008_P12_SESSIONS_REVOKED_AT_SET` | 12 | `assertPasswordChangeFinalizationProof` | `PATCH83U_SESSIONS_REVOKED_AT_SET_NOT_PROVEN` |
| `R008_P12_GOVERNANCE_AND_RECONCILIATION_CLEARED` | 12 | `assertAfterPasswordChangeAggregate` | `PATCH83U_AFTER_PASSWORD_CHANGE_AGGREGATE_FAILED` |
| `R008_P12_PASSWORD_CHANGE_AUDIT_CORRELATED` | 12 | `assertAuditCheckpoint` | `PATCH83U_AUDIT_CHECKPOINT_NOT_PROVEN` |
| `R008_P12_BROWSER_SIGNED_OUT` | 12 | `assertAfterPasswordChangeAggregate` | `PATCH83U_AFTER_PASSWORD_CHANGE_AGGREGATE_FAILED` |
| `R008_P13_FRESH_PERMANENT_LOGIN` | 13 | `assertFreshPermanentLoginProof` | `PATCH83U_FRESH_PERMANENT_LOGIN_IDENTITY_NOT_PROVEN` |
| `R008_P13_EMPLOYEE_ROLE_SCOPE_PRESERVED` | 13 | `assertFinalFreshLoginAggregate` | `PATCH83U_FINAL_FRESH_LOGIN_AGGREGATE_FAILED` |
| `R008_P13_DIRECT_ADMIN_DENIED` | 13 | `assertFreshPermanentLoginProof` | `PATCH83U_FINAL_EMPLOYEE_AUTHORIZATION_PROOF_FAILED` |
| `R008_P13_NETWORK_CONSOLE_SAFE` | 13 | `assertNetworkConsoleSafeAggregate` | `PATCH83U_NETWORK_CONSOLE_SAFE_PROOF_FAILED` |
| `R008_P14_CHECKPOINT6_READ_ONLY` | 14 | `assertSqlEditorEvidenceSnapshot` | `PATCH83U_SQL_EDITOR_EVIDENCE_GATE_FAILED` |
| `R008_P14_EXACT_FINAL_SESSION_COUNT` | 14 | `assertFinalFreshLoginCounts` | `PATCH83U_FINAL_SESSION_COUNT_MISMATCH` |
| `R008_P14_EXACT_FINAL_REFRESH_COUNT` | 14 | `assertFinalFreshLoginCounts` | `PATCH83U_FINAL_UNREVOKED_REFRESH_COUNT_MISMATCH` |
| `R008_P14_ADMIN_AND_RUNTIME_UNCHANGED` | 14 | `assertFinalFreshLoginAggregate` | `PATCH83U_FINAL_FRESH_LOGIN_AGGREGATE_FAILED` |
| `R008_P14_REDACTED_EVIDENCE_VALID` | 14 | `assertEvidenceMatchesSchemaContract` | `PATCH83U_PROHIBITED_EVIDENCE_KEY` |

The matrix deliberately treats Checkpoint 5 as a zero-session/zero-refresh finalization proof and Checkpoint 6 as the separate post-login proof of exactly one active session and exactly one unrevoked refresh row. Neither value is operator-configurable.
