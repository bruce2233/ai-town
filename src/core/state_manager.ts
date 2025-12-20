import { Context, Ref, Layer, Effect } from "effect";
import { GlobalState } from "./model.js";

// Service Tag
export class StateManager extends Context.Tag("StateManager")<
    StateManager,
    Ref.Ref<GlobalState | null>
>() { }

// Live Layer - initializes with null
export const StateManagerLive = Layer.effect(
    StateManager,
    Ref.make<GlobalState | null>(null)
);
