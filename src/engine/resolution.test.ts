import { describe, it, expect } from "vitest";
import { Effect, Context } from "effect";
import { createEngine } from "../engine/index.js"; // Relative import from src/engine/index.ts
import { GlobalState, AgentId, LocationId, LLMService } from "../core/index.js";

describe("Resolution Engine (g)", () => {
    const mockState: GlobalState = {
        tick: 0,
        agents: {
            ["agent_1" as AgentId]: {
                id: "agent_1" as AgentId,
                name: "Alice",
                description: "Test",
                locationId: "loc_0" as LocationId,
                memory: {}
            }
        },
        locations: {
            ["loc_0" as LocationId]: { id: "loc_0" as LocationId, name: "Loc A", description: "Desc A" },
            ["loc_1" as LocationId]: { id: "loc_1" as LocationId, name: "Loc B", description: "Desc B" }
        }
    };

    // A fast LLM Mock that returns empty text (Engine uses fallback deterministic logic for MVP)
    const LLMServiceTest = LLMService.of({
        generateCompletion: (_prompt) => Effect.succeed("Mock LLM Response"),
        generateJson: (_prompt, _schema) => Effect.succeed({} as any)
    });

    it("should resolve a MoveIntent correctly", async () => {
        const engine = await Effect.runPromise(
            createEngine().pipe(
                Effect.provideService(LLMService, LLMServiceTest)
            )
        );

        const intents = [{
            _tag: "Move",
            agentId: "agent_1" as AgentId,
            targetLocationId: "loc_1" as LocationId
        } as const];

        const result = await Effect.runPromise(
            engine.resolve(intents, mockState)
        );

        // Check State Update
        expect(result.state.tick).toBe(1);
        expect(result.state.agents["agent_1" as AgentId].locationId).toBe("loc_1");

        // Check Events
        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe("AGENT_MOVED");
        expect(result.events[0].payload).toEqual({ agentId: "agent_1", to: "loc_1" });
    });
});
