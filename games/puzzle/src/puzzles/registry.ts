import type { PuzzleDef, PuzzleLogic, PuzzleAction } from './types.ts';
import * as river from './river/logic.ts';
import { logic as bridge, levels as bridgeLevels } from './bridge/logic.ts';
import { logic as water, levels as waterLevels } from './water/logic.ts';
import { translations as r } from './river/strings.ts';
import { translations as b } from './bridge/strings.ts';
import { translations as w } from './water/strings.ts';
const locale = typeof location !== 'undefined' && (new URLSearchParams(location.search).get('locale') || (typeof navigator !== 'undefined' ? navigator.language : 'en')).toLowerCase().startsWith('zh') ? 'zh-TW' : 'en';
const riverLogic: PuzzleLogic<river.State> = { initial: river.initial, apply: (s, a) => a.type === 'toggle' ? river.toggle(s, a.id) : ['cross', 'go'].includes(a.type) ? river.cross(s) : { ok: false, reason: 'unknown' }, isWin: river.isWin, failure: s => s.failure, score: s => s.crossings, isMove: a => a.type === 'cross' || a.type === 'go', solve: river.solve, solution: level => {
        let aboard: string[] = [];
        const actions: PuzzleAction[] = [];
        for (const load of river.solution(level)) {
            for (const id of aboard)
                actions.push({ type: 'toggle', id });
            for (const id of load)
                actions.push({ type: 'toggle', id });
            actions.push({ type: 'cross' });
            aboard = load;
        }
        return actions;
    }, hint: s => !s.aboard.includes('farmer') ? s.aboard.length ? 'farmerError' : 'hint0' : s.crossings === 0 && !s.aboard.includes('goat') ? s.aboard.length === 2 ? 'firstGoat' : 'hint1' : 'hint2' };
export const registry: Record<'river' | 'bridge' | 'water', PuzzleDef> = {
    river: { id: 'river', storagePrefix: 'river', metric: 'crossings', levels: { easy: { optimal: 7, twoStar: 10 }, medium: { optimal: 11, twoStar: 15 }, hard: { optimal: 13, twoStar: 17 } }, logic: riverLogic, strings: r[locale], loadScene: () => import('./river/scene.ts') },
    bridge: { id: 'bridge', storagePrefix: 'bridge', metric: 'minutes', levels: bridgeLevels, logic: bridge, strings: b[locale], night: true, loadScene: () => import('./bridge/scene.ts') },
    water: { id: 'water', storagePrefix: 'water', metric: 'steps', levels: waterLevels, logic: water, strings: w[locale], loadScene: () => import('./water/scene.ts') }
};
