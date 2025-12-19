import { describe, it, expect } from "vitest";
import { project, GlobalState, AgentId, LocationId } from "./index.js";

describe("Projection (pi)", () => {
    const mockState: GlobalState = {
        tick: 10,
        agents: {
            ["agent_1" as AgentId]: {
                id: "agent_1" as AgentId,
                name: "Alice",
                description: "A wanderer",
                locationId: "loc_0" as LocationId,
                memory: {}
            }
        },
        locations: {
            ["loc_0" as LocationId]: {
                id: "loc_0" as LocationId,
                name: "Home",
                description: "Sweet home"
            }
        }
    };

    it("should generate a correct text description for the agent", () => {
        const view = project(mockState, "agent_1" as AgentId);

        expect(view.description).toContain("You are Alice (A wanderer)");
        expect(view.description).toContain("You are currently at Home (Sweet home)");
        expect(view.description).toContain("Current Tick: 10");
        expect(view.rawData).toEqual(mockState);
    });

    it("should handle non-existent agents", () => {
        const view = project(mockState, "agent_999" as AgentId);
        expect(view.description).toBe("You do not exist.");
    });
});
