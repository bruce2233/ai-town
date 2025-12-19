import { describe, it, expect } from "vitest";
import { Schema } from "effect";
import { GlobalState, AgentId, LocationId } from "./model.js";

describe("GlobalState", () => {
    it("should validate a correct state", () => {
        const validState = {
            tick: 0,
            agents: {
                ["agent_1"]: {
                    id: "agent_1",
                    name: "Alice",
                    description: "Test agent",
                    locationId: "loc_0",
                    memory: {}
                }
            },
            locations: {
                ["loc_0"]: {
                    id: "loc_0",
                    name: "Test Location",
                    description: "A test place"
                }
            }
        };

        const result = Schema.decodeUnknownSync(GlobalState)(validState);
        expect(result).toEqual(validState);
    });

    it("should fail validation for invalid state (missing field)", () => {
        const invalidState = {
            tick: 0,
            agents: {},
            // Missing locations
        };

        expect(() => Schema.decodeUnknownSync(GlobalState)(invalidState)).toThrow();
    });
});
