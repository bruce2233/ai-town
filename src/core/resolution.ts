import { Effect } from "effect";
import { GlobalState, Event } from "./model.js";
import { Intent } from "./intent.js";

// ---------------------------------------------
// Resolution Engine Interface
// ---------------------------------------------

export interface ResolutionEngine {
    readonly resolve: (
        intents: ReadonlyArray<Intent>,
        state: GlobalState
    ) => Effect.Effect<{ state: GlobalState; events: ReadonlyArray<Event> }, Error>;
}
