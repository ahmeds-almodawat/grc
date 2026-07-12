# Patch 83Q.1 Input Contract

The post-migration live public-schema dump from Patch 83Q was inspected before implementation. The dispatcher uses these exact RPC signatures and argument names:

| Browser action | Fixed RPC | Exact RPC arguments |
| --- | --- | --- |
| `create_pilot_go_no_go_review` | `public.create_pilot_go_no_go_review(text, uuid)` | `p_title`, `p_actor_id` |
| `update_pilot_go_no_go_review_status` | `public.update_pilot_go_no_go_review_status(uuid, text, text, uuid)` | `p_review_id`, `p_status`, `p_notes`, `p_actor_id` |
| `record_pilot_go_no_go_event` | `public.record_pilot_go_no_go_event(uuid, text, text, uuid)` | `p_review_id`, `p_event_type`, `p_event_summary`, `p_actor_id` |
| `record_executive_production_signoff` | `public.record_executive_production_signoff(uuid, text, text, text)` | `p_actor_id`, `p_decision`, `p_notes`, `p_snapshot_hash` |

The existing frontend payloads for the Patch 44 pilot actions use `title`, `review_id`, `status`, `notes`, `event_type`, `event_summary`, and `actor_id`. The bridge ignores caller-supplied `actor_id` and derives the RPC actor from the validated JWT user. There is no active frontend signoff mutation call; its checked-in RPC and registry contract use `decision`, `notes`, and optional `snapshot_hash`.

The live `pilot_go_no_go_reviews` constraint permits exactly `draft`, `ready_for_review`, `approved_for_controlled_pilot`, `approved_with_limitations`, `blocked`, and `rejected`. The live event table and RPC define `event_type` as unconstrained text, so Patch 83Q.1 does not invent an enum; it validates a bounded lowercase snake_case identifier. The live executive signoff constraint permits only `approved`.
