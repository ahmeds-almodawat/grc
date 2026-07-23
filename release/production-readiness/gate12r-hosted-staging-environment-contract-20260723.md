# Gate 12R hosted staging environment contract

The approved hosted staging target is the dedicated Vercel project `grc-staging` at `https://grc-staging-lilac.vercel.app`, bound only to Supabase staging project `zghsgzrdwbqdrpuxanac`. Production project `zbrjjecpsrzposhuarcn` is prohibited.

The build contract is Vite with `npm ci`, `npm run build`, and output directory `dist`. Patch 83U credential governance and Cloudflare Turnstile CAPTCHA are mandatory. The public site key is browser configuration; the corresponding secret remains only in protected Supabase Auth configuration.

All deployment must bind the exact future release commit SHA, retain deployment protection, avoid automatic promotion, and refuse any production Supabase reference or service-role/secret-shaped browser value. No deployment is authorized by this contract. Current deployment count is zero.
