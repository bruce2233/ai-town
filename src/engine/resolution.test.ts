import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { createEngine } from "./index.js";
import { GlobalState, AgentId, ActionIntent, LLMService, LLMServiceMock } from "../core/index.js";

describe("Resolution Engine", () => {
    it("should resolve actions and update history", async () => {
        const engine = await Effect.runPromise(
            createEngine().pipe(Effect.provideServiceEffect(LLMService, LLMServiceMock))
        );

        const state: GlobalState = {
            tick: 0,
            agents: {
                ["agent_1" as AgentId]: {
                    id: "agent_1" as AgentId,
                    name: "Alice",
                    description: "Test Agent",
                    locationId: "loc_0" as any,
                    status: "Idle",
                    memory: {},
                }
            },
            locations: {
                ["loc_0" as any]: { id: "loc_0", name: "Room", description: "Empty" }
            },
            history: [],
        };

        const intent: ActionIntent = {
            _tag: "Action",
            agentId: "agent_1" as AgentId,
            instruction: "I wave."
        };

        const result = await Effect.runPromise(
            engine.resolve([intent], state).pipe(Effect.orDie) // Handle strict error
        );

        // Mock LLM returns empty object usually or generic string,
        // but our engine pushes "Nothing happened" if narrative is missing in mock
        // OR it uses the mock response.
        // Let's just check history length grew
        expect(result.state.history.length).toBeGreaterThan(0);
    });
});
