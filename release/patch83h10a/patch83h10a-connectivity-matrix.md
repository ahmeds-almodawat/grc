# Patch 83H.10A: Connectivity Matrix

| Environment | DNS Reachability | TCP Reachability | Notes |
|-------------|------------------|------------------|-------|
| Windows CLI | Success | Success | Pooler reachable via IPv4. |
| Docker | Success | Success | Verified via postgres:17-alpine |
| Direct (IPv6)| Failed | Failed | Host lacks IPv6 capability |
| CLI Internal| Failed | Failed | `public.ecr.aws/supabase/postgres:17.6.1.063` hangs |
