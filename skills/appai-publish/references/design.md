# Design judgment

Pick the kit by the user's stated mood first (e.g. 'fresh and calm' → forest), then by business type. If no kit description matches, pick by light/dark and warm/cool.

| Kit | Mode | Mood words | Typical businesses |
|---|---|---|---|
| indigo | light | crisp, modern, confident | SaaS, software, technology, professional services |
| forest | light | natural, wellbeing, fresh and calm | nature, wellness, health, sustainable businesses |
| editorial | light | literary, refined, thoughtful | publishing, portfolios, culture, consulting |
| ocean | light | clear, cool, trustworthy | travel, education, healthcare, services |
| midnight | dark | sleek, technical, bold | developer tools, gaming, technology |
| hearth | light | warm, handmade, welcoming | bakeries, cafés, crafts, classes |
| ember | dark | warm, intimate, atmospheric | restaurants, bars, hospitality, creative studios |



MUST READ [Style & logo](https://appai.info/spec/style) before publishing. Select a style kit at [Theme](https://appai.info/spec/theme); copy `themeColor`, `themeColorSecondary`, `fontFamily` (Chinese variants: `Noto Sans TC`/`Noto Sans SC`) and `darkMode` together, and use the kit's suggested `backgroundColors` for section `data.backgroundColor` when provided; otherwise leave it unset. When a kit has two `backgroundColors`, alternate them section by section, starting with the first. Exception: `cta` ignores `backgroundColor` and always uses `themeColor`. Use the kit’s `fontFamily` for `en` and `es`, `Noto Sans TC` for `zh-TW`, and `Noto Sans SC` for `zh-CN`; for other CJK languages chosen by the user, choose the matching font (e.g. `Noto Sans JP` for Japanese). Keep `themeColor`, `themeColorSecondary`, `darkMode` and the kit’s suggested backgroundColors the same across variants.

Choose a visual direction that supports the product's main action. Keep decorative changes subordinate to readability, and inspect the page at mobile width before adding more visual elements. A category is context for choosing a kit, not a separate palette.
