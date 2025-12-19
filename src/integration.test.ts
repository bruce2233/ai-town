import { Effect, Schema } from "effect";
import {
    GlobalState,
    AgentId,
    LocationId,
    project,
    LLMService,
    LLMServiceLive
} from "./core/index.js";
import { createEngine } from "./engine/index.js";
import { createLLMAgent } from "./agents/index.js";
import { describe, it, expect } from "vitest";

describe("Integration: Real LLM Loop", () => {
    it("should evolve state and narrative using Qwen3", async () => {
        // 1. Setup State
        let state: GlobalState = {
            tick: 0,
            agents: {
                ["agent_1" as AgentId]: {
                    id: "agent_1" as AgentId,
                    name: "Alice",
                    description: "A curious explorer.",
                    locationId: "loc_0" as LocationId,
                    status: "Looking around",
                    memory: {},
                },
                ["agent_2" as AgentId]: {
                    id: "agent_2" as AgentId,
                    name: "Bob",
                    description: "A grumpy guard.",
                    locationId: "loc_1" as LocationId,
                    status: "Standing guard",
                    memory: {},
                },
            },
            locations: {
                ["loc_0" as LocationId]: { id: "loc_0" as LocationId, name: "Gate", description: "Stone gate" },
                ["loc_1" as LocationId]: { id: "loc_1" as LocationId, name: "Hall", description: "Grand hall" },
            },
            history: []
        };

        // 2. Setup System
        // We use the LIVE service here
        const program = Effect.gen(function* (_) {
            const engine = yield* createEngine();
            const agent1 = yield* createLLMAgent("agent_1" as AgentId);
            const agent2 = yield* createLLMAgent("agent_2" as AgentId);
            const agents = [agent1, agent2];

            // Run 2 Ticks
            for (let i = 0; i < 2; i++) {
                const intents = [];
                for (const agent of agents) {
                    const view = yield* project(state, agent.id);
                    const intent = yield* agent.act(view);
                    intents.push(intent);
                }
                const result = yield* engine.resolve(intents, state);
                state = result.state;
            }
            return state;
        }).pipe(
            Effect.provideServiceEffect(LLMService, LLMServiceLive)
        );

        // 3. Execution (Real Network Call)
        // Increase timeout because Local LLM might be slow
        const finalState = await Effect.runPromise(program.pipe(Effect.orDie));

        // 4. Assertions
        expect(finalState.tick).toBe(2);
        expect(finalState.history.length).toBeGreaterThan(0);
        expect(finalState.history[0]).not.toBe("Nothing happened.");

        console.log("Integration Test Final History:", finalState.history);
    }, 30000); // 30s timeout
});
