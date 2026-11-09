// Compatibility facade for integrations that still use the original river-only Diorama API.
import { Stage } from './stage.ts';
import { RiverScene } from '../puzzles/river/scene.ts';
import type { State } from '../puzzles/river/logic.ts';
export { Stage } from './stage.ts';
export type { Metrics } from './stage.ts';
export class Diorama extends Stage {
    constructor(canvas: HTMLCanvasElement, dark: boolean, pick: (id: string) => void) { super(canvas, dark, pick); this.mount(new RiverScene(this, 'easy', dark), dark); }
    sync(state: State) {
        if ((this.current as RiverScene).state?.level !== state.level)
            this.mount(new RiverScene(this, state.level, this.themeDark), this.themeDark);
        this.current!.sync(state);
    }
    sail(to: State, done: () => void) { const river = this.current as RiverScene; river.animate(river.state!, to, done); }
    get sailing() { return !!this.current?.busy; }
    get boat() { return (this.current as RiverScene).boat; }
    get actors() { return (this.current as RiverScene).actors; }
    get hit() { return this.current?.hit ?? []; }
    get state() { return (this.current as RiverScene).state; }
}
