import { Effect, Schedule } from "effect";
import {
    AgentView,
    Intent,
    AgentId,
    MoveIntent,
    LocationId,
    LLMService,
    SpeakIntent,
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
- Move to a location (loc_0, loc_1, loc_2, loc_3, loc_4)
- Speak to someone

Decide your next action based on your description and return JSON.
Format:
{ "_tag": "Move", "targetLocationId": "loc_X" }
OR
{ "_tag": "Speak", "content": "Hello", "targetAgentId": "agent_X" }
`;

                    // Call LLM (In reality, we would validate the schema here)
                    // For the Mock, we need to ensure it returns something valid or we default to random
                    const responseStr = yield* llm.generateCompletion(prompt);

                    // MOCK HACK: Since our mock just returns text, we'll parse it or fallback.
                    // ideally LLMService.generateJson would be used.

                    // Let's assume for this MVP step we stick to Random if LLM fails or Mock is dumb
                    // But to prove it works, let's try to interpret the Mock response

                    // For now, let's just make the Mock "Simulated Intelligence" return a valid MoveIntent
                    // inside the LLMService (or here if we want to fake it locally).

                    // REAL implementation would be:
                    // const intent = yield* llm.generateJson(prompt, IntentSchema);

                    // FALLBACK to Random for stability if LLM is mock text
                    return {
                        _tag: "Move",
                        agentId: id,
                        targetLocationId: `loc_${Math.floor(Math.random() * 5)}` as LocationId
                    } as MoveIntent;
                }),
        };
    });
