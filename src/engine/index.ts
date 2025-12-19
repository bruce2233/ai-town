import { Effect } from "effect";
import {
    GlobalState,
    Event,
    ResolutionEngine,
    Intent,
    MoveIntent,
    LLMService,
} from "../core/index.js";

// ---------------------------------------------
// Engine Logic ($g$) - LLM Powered
// ---------------------------------------------

export const createEngine = (): Effect.Effect<ResolutionEngine, never, LLMService> =>
    Effect.gen(function* (_) {
        const llm = yield* LLMService;

        return {
            resolve: (
                intents: ReadonlyArray<Intent>,
                state: GlobalState
            ): Effect.Effect<{ state: GlobalState; events: ReadonlyArray<Event> }, Error> =>
                Effect.gen(function* (_) {
                    let newState = JSON.parse(JSON.stringify(state)) as GlobalState;
                    const events: Event[] = [];

                    // 1. Construct World DM Prompt
                    // In a real system, we would dump the state diff and intents to the LLM
                    const prompt = `
Current State Stick: ${state.tick}
Intents: ${JSON.stringify(intents)}
Resolve conflicts and return allowed moves.
`;
                    // 2. Call LLM (Mocked for now)
                    const _response = yield* llm.generateCompletion(prompt);

                    // 3. Apply changes (Deterministic fallback for MVP stability)
                    for (const intent of intents) {
                        if (intent._tag === "Move") {
                            const move = intent as MoveIntent;
                            // Cast to any to bypass readonly check for MVP mutable update on cloned state
                            const agent = (newState.agents as any)[move.agentId];
                            if (agent) {
                                // TODO: Check if location exists and is valid (LLM would do this)
                                const location = newState.locations[move.targetLocationId];
                                if (location) {
                                    agent.locationId = move.targetLocationId;
                                    events.push({
                                        id: Math.random().toString(36).substring(7),
                                        timestamp: Date.now(),
                                        type: "AGENT_MOVED",
                                        payload: { agentId: move.agentId, to: move.targetLocationId },
                                    });
                                }
                            }
                        } else if (intent._tag === "Speak") {
                            // TODO: Handle Speak
                        }
                    }

                    (newState as any).tick++;

                    return { state: newState, events };
                }),
        };
    });
