import { describe, it, expect } from "vitest";
import { Schema } from "effect";
import { GlobalState } from "./model.js";

describe("Model Schema", () => {
    it("should validate a correct GlobalState", () => {
        const validState = {
            tick: 0,
            agents: {},
            locations: {},
            history: [],
        };
        const result = Schema.decodeUnknownSync(GlobalState)(validState);
        expect(result).toEqual(validState);
    });
});
