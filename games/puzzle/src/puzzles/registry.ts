import type { PuzzleDef } from './types.ts';
import * as river from './river/logic.ts';
import { logic as bridge, levels as bridgeLevels } from './bridge/logic.ts';
import { logic as water, levels as waterLevels } from './water/logic.ts';
import { translations as r } from './river/strings.ts';
import { translations as b } from './bridge/strings.ts';
import { translations as w } from './water/strings.ts';
const locale = typeof location !== 'undefined' && (new URLSearchParams(location.search).get('locale') || (typeof navigator !== 'undefined' ? navigator.language : 'en')).toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
export const registry: Record<'river' | 'bridge' | 'water', PuzzleDef> = {
    river: { id: 'river', storagePrefix: 'river', metric: 'crossings', levels: { easy: { optimal: 7, twoStar: 10 }, medium: { optimal: 11, twoStar: 15 }, hard: { optimal: 13, twoStar: 17 } }, logic: river.logic, strings: r[locale], loadScene: () => import('./river/scene.ts') },
    bridge: { id: 'bridge', storagePrefix: 'bridge', metric: 'minutes', levels: bridgeLevels, logic: bridge, strings: b[locale], night: true, loadScene: () => import('./bridge/scene.ts') },
    water: { id: 'water', storagePrefix: 'water', metric: 'steps', levels: waterLevels, logic: water, strings: w[locale], loadScene: () => import('./water/scene.ts') }
};
