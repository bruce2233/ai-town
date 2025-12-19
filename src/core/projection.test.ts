import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { project } from "./projection.js";
import { GlobalState, AgentId, LocationId } from "./model.js";
import { LLMService, LLMServiceMock } from "./llm.js";

describe("Projection", () => {
    it("should use LLM to generate description", async () => {
        const state: GlobalState = {
            tick: 10,
            agents: {
                ["agent_1" as AgentId]: {
                    id: "agent_1" as AgentId,
                    name: "Alice",
                    description: "Explorer",
                    locationId: "loc_0" as LocationId,
                    status: "Idle",
                    memory: {},
                },
            },
            locations: {
                ["loc_0" as LocationId]: { id: "loc_0" as LocationId, name: "Home", description: "Sweet home" },
            },
            history: ["Something happened"],
        };

        // Create the program
        const program = project(state, "agent_1" as AgentId).pipe(
            Effect.provideServiceEffect(LLMService, LLMServiceMock)
        );

        // Run it
        const view = await Effect.runPromise(program);

        expect(view.description).toContain("Mock response"); // LLMServiceMock returns this
        expect(view.rawData.tick).toBe(10);
    });

    it("should handle non-existent agent", async () => {
        const state: GlobalState = {
            tick: 0,
            agents: {},
            locations: {},
            history: [],
        };

        const program = project(state, "missing" as AgentId).pipe(
            Effect.provideServiceEffect(LLMService, LLMServiceMock)
        );

        const view = await Effect.runPromise(program);
        expect(view.description).toBe("You do not exist.");
    });
});
