import { Schema } from "effect";

// ---------------------------------------------
// Identity Types
// ---------------------------------------------

export const AgentId = Schema.String.pipe(Schema.brand("AgentId"));
export type AgentId = Schema.Schema.Type<typeof AgentId>;

export const LocationId = Schema.String.pipe(Schema.brand("LocationId"));
export type LocationId = Schema.Schema.Type<typeof LocationId>;

// ---------------------------------------------
// Component Types
// ---------------------------------------------

// ---------------------------------------------
// Component Types
// ---------------------------------------------

export const AgentState = Schema.Struct({
    id: AgentId,
    name: Schema.String,
    description: Schema.String,
    locationId: LocationId,
    // Arbitrary memory/state for the agent
    memory: Schema.Record({ key: Schema.String, value: Schema.Any }),
});
export type AgentState = Schema.Schema.Type<typeof AgentState>;

// ---------------------------------------------
// Global Truth ($S_t$)
// ---------------------------------------------

export const GlobalState = Schema.Struct({
    tick: Schema.Number,
    agents: Schema.Record({ key: AgentId, value: AgentState }),
    locations: Schema.Record({
        key: LocationId,
        value: Schema.Struct({
            id: LocationId,
            name: Schema.String,
            description: Schema.String,
        }),
    }),
});
export type GlobalState = Schema.Schema.Type<typeof GlobalState>;

// ---------------------------------------------
// Event Sourcing
// ---------------------------------------------

export const Event = Schema.Struct({
    id: Schema.String,
    timestamp: Schema.Number,
    type: Schema.String,
    payload: Schema.Unknown,
});
export type Event = Schema.Schema.Type<typeof Event>;
