import { Effect, Schema } from "effect";
import {
    GlobalState,
    Event,
    ResolutionEngine,
    Intent,
    MoveIntent,
    LLMService,
    AgentId,
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
                    const recentHistory = state.history.slice(-3).join("\n");
                    const agentStates = Object.values(state.agents).map(a => `- ${a.name} is at ${state.locations[a.locationId].name} (${a.status})`).join("\n");

                    let actionText = "";
                    for (const intent of intents) {
                        if (intent._tag === "Action") {
                            const agent = state.agents[intent.agentId];
                            actionText += `- ${agent.name} wants to: ${intent.instruction}\n`;
                        } else if (intent._tag === "Move") {
                            // Legacy support or specific handling
                            const agent = state.agents[intent.agentId];
                            actionText += `- ${agent.name} wants to move to ${intent.targetLocationId}\n`;
                        }
                    }

                    const prompt = `
The Story So Far:
${recentHistory}

Current Situation:
${agentStates}

Agent Actions:
${actionText}

Determine the outcome. Return JSON:
{
  "narrative": "A short paragraph describing what happens.",
  "updates": {
    "agent_id": { "status": "New Status", "locationId": "optional_new_loc_id" }
  }
}
`;
                    // 2. Call LLM
                    const result = yield* llm.generateJson(prompt, Schema.Any) as any;

                    // 3. Apply changes
                    (newState.history as string[]).push(result.narrative || "Nothing happened.");

                    if (result.updates) {
                        for (const [agentId, update] of Object.entries(result.updates)) {
                            const agent = (newState.agents as any)[agentId];
                            if (agent) {
                                if ((update as any).status) {
                                    agent.status = (update as any).status;
                                }
                                if ((update as any).locationId && newState.locations[(update as any).locationId]) {
                                    agent.locationId = (update as any).locationId;
                                    events.push({
                                        id: Math.random().toString(36).substring(7),
                                        timestamp: Date.now(),
                                        type: "AGENT_MOVED",
                                        payload: { agentId: agentId as AgentId, to: (update as any).locationId },
                                    });
                                }
                            }
                        }
                    }

                    (newState as any).tick++;

                    return { state: newState, events };
                }).pipe(
                    Effect.mapError(e => new Error(String(e)))
                ) as unknown as Effect.Effect<{ state: GlobalState; events: ReadonlyArray<Event> }, Error>,
        };
    });
