# UI-1 Semantic Token Mapping

This mapping consolidates the repeated token namespaces without removing legacy
variables. The new platform tokens are the approved semantic source. Existing
aliases continue to resolve so versioned screens retain their current contracts.

| Existing token / usage | Approved semantic token |
|---|---|
| `--color-page`, `--ui-page`, `--ui-bg`, `--grc-bg` | `--platform-app-background` |
| fixed sidebar backgrounds and `--nav-background` | `--platform-sidebar-background` |
| sidebar controls and child rows | `--platform-sidebar-surface` |
| `--nav-text` and fixed sidebar text | `--platform-sidebar-text` |
| sidebar secondary copy | `--platform-sidebar-muted` |
| sidebar hover fills | `--platform-sidebar-hover` |
| sidebar active fills | `--platform-sidebar-active` |
| `--color-surface`, `--ui-surface-solid`, `--grc-surface-strong` | `--platform-surface-primary` |
| `--color-surface-muted`, `--ui-surface-muted` | `--platform-surface-secondary` |
| `--color-surface-elevated` | `--platform-surface-elevated` |
| `--color-border`, `--ui-border`, `--grc-border` | `--platform-border-default` |
| subtle separators | `--platform-border-subtle` |
| `--color-text-primary`, `--ui-ink`, `--grc-text` | `--platform-text-primary` |
| `--color-text-secondary` | `--platform-text-secondary` |
| `--color-text-muted`, `--ui-muted`, `--grc-muted` | `--platform-text-muted` |
| primary buttons and active controls | `--platform-brand-primary` |
| primary button hover | `--platform-brand-hover` |
| active/selected soft fill | `--platform-brand-soft` |
| success foreground / badges | `--platform-success` |
| success soft surfaces | `--platform-success-background` |
| warning foreground / badges | `--platform-warning` |
| warning soft surfaces | `--platform-warning-background` |
| danger foreground / badges | `--platform-danger` |
| danger soft surfaces | `--platform-danger-background` |
| information foreground / badges | `--platform-info` |
| information soft surfaces | `--platform-info-background` |
| classification foreground | `--platform-purple` |
| classification soft surfaces | `--platform-purple-background` |
| `--color-focus-ring` and focus outlines | `--platform-focus` |
| `--color-overlay`, `--color-backdrop` | `--platform-overlay` |
| `--ui-shadow`, `--grc-shadow` | `--platform-shadow-elevated` |
| `--ui-shadow-soft`, `--grc-shadow-soft` | `--platform-shadow-soft` |

## Stable Reference Samples

Stable flat areas sampled from the locked PNGs were used as cross-checks, not as
the sole source of color decisions:

- Executive light sidebar: `#ffffff`
- Executive light active navigation: approximately `#e9f0fb`
- Executive light application canvas: approximately `#fbfbfc`
- Executive dark sidebar: approximately `#070f1a`
- Executive dark application canvas: approximately `#0b121c`
- Executive dark card surface: approximately `#121a23`

Anti-aliased text, shadows, chart edges, and blended regions were excluded.
