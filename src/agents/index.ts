import { Effect, Schema, Schedule } from "effect";
import {
    AgentView,
    Intent,
    AgentId,
    MoveIntent,
    LocationId,
    LLMService,
    SpeakIntent,
    ActionIntent
} from "../core/index.js";

// ---------------------------------------------
// Policy Function Interface ($f_i$)
// ---------------------------------------------

export interface Agent {
    readonly id: AgentId;
    readonly act: (view: AgentView) => Effect.Effect<Intent, Error>;
}

// ---------------------------------------------
// Random Agent (Legacy/Testing)
// ---------------------------------------------

export const createRandomAgent = (id: AgentId): Agent => ({
    id,
    act: (view) =>
        Effect.succeed({
            _tag: "Move",
            agentId: id,
            targetLocationId: `loc_${Math.floor(Math.random() * 5)}` as LocationId,
        } as MoveIntent),
});

// ---------------------------------------------
// LLM Agent (Intelligent)
// ---------------------------------------------

export const createLLMAgent = (id: AgentId): Effect.Effect<Agent, never, LLMService> =>
    Effect.gen(function* (_) {
        const llm = yield* LLMService;

        return {
            id,
            act: (view) =>
                Effect.gen(function* (_) {
                    // Construct Prompt
                    const prompt = `
You are an AI Agent in a simulated town.
${view.description}

Available Actions:
- Describe what you want to do next in natural language based on the recent events.
- BE CREATIVE and REACTIVE. Do NOT repeat the same action if you just did it.
- If you are at the destination, interact with someone or look around.

Decide your next action based on your description and return JSON.
Format:
{ "_tag": "Action", "instruction": "I walk to the park" }
`;

                    // Call LLM
                    const response = yield* llm.generateJson(prompt, Schema.Any);

                    return {
                        _tag: "Action",
                        agentId: id,
                        instruction: (response as any).instruction || "I wait."
                    } as ActionIntent;
                }),
        };
    });
