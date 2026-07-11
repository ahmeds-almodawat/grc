# Patch 83H.8: Baseline Option Matrix

| design | description | remote_safety | local_reproducibility | drift_risk | implementation_complexity | ci_support | maintenance_cost | rollback_complexity | overall_risk | recommendation |
|--------|-------------|---------------|-----------------------|------------|---------------------------|------------|------------------|---------------------|--------------|----------------|
| Design A | Local baseline SQL snapshot | High | High | Med | Medium | Med | Med | Low | Medium | Alternative |
| Design B | Local bootstrap script loading snapshot | High | High | Low | Medium | High | Low | Low | Low | Yes |
| Design C | Dedicated local migrations directory | Med | High | High | High | Low | High | Medium | High | No |
| Design D | Temporary local baseline branch | Low | High | Med | High | Low | High | Medium | High | No |
| Design E | Schema dump from non-prod clone | High | High | Low | Medium | High | Low | Low | Low | **Yes (Recommended)** |
