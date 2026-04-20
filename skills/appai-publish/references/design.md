# Design System

## themeColor by category

| Category | themeColor | Rationale |
|----------|------------|-----------|
| FINANCE | `#0891B2` teal / `#1D4ED8` blue | Trust, stability |
| CODING, AUTOMATION | `#6366F1` indigo / `#06B6D4` cyan | Technical precision |
| DESIGN, WRITING | `#8B5CF6` violet / `#EC4899` pink | Creative energy |
| HEALTH | `#059669` emerald | Wellness, natural |
| FOOD | `#D97706` amber / `#DC2626` red | Appetite, warmth |
| EDUCATION | `#7C3AED` purple | Intellectual |
| TRAVEL | `#0EA5E9` sky / `#F59E0B` amber | Horizon, adventure |
| ENTERTAINMENT, MEDIA | `#EC4899` pink / `#F43F5E` rose | Energy, play |
| GAMES | `#8B5CF6` violet / `#10B981` green | Playful |
| COMMERCE | `#EF4444` red / `#F97316` orange | Action, conversion |
| SOCIAL | `#8B5CF6` violet | Connection |
| PRODUCTIVITY, UTILITIES | `#0F172A` slate / `#6366F1` indigo | Focused, clean |

## backgroundColor per section (dark mode)

Use the darker palette when `darkMode: true`:
- Hero: `#0F172A` (slate-900) or `#111827` (gray-900)
- Features: `#1E293B` (slate-800)
- Stats: themeColor at 15% opacity, e.g. `#0F172A` with accent border
- FAQ: `#0F172A`

## backgroundColor per section (light mode)

- Hero: `#FFFFFF` or themeColor-50 (e.g. `#EFF6FF` for blue)
- Features: themeColor-50
- Stats: `#F9FAFB` (gray-50) or themeColor-100
- FAQ: `#FFFFFF`

## Fonts

| Tone | Google Fonts |
|------|--------------|
| Clean/modern SaaS | `Inter`, `DM Sans` |
| Geometric/friendly | `Poppins`, `Nunito` |
| Technical/dev | `Space Grotesk`, `JetBrains Mono` |
| Editorial/premium | `Playfair Display`, `Lora` |
| Japanese | `Noto Sans JP`, `M PLUS Rounded 1c` |
| Chinese | `Noto Sans TC`, `Noto Sans SC` |

Pass via `fontFamily` field. AppAI auto-loads the font URL.
