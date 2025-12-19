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
    agents: Schema.Record({
        key: AgentId,
        value: Schema.Struct({
            id: AgentId,
            name: Schema.String,
            description: Schema.String,
            locationId: LocationId,
            status: Schema.String, // e.g. "Standing idly", "Talking to Bob" (Text-Native)
            memory: Schema.Record({ key: Schema.String, value: Schema.Any }),
        }),
    }),
    locations: Schema.Record({
        key: LocationId,
        value: Schema.Struct({
            id: LocationId,
            name: Schema.String,
            description: Schema.String,
        }),
    }),
    history: Schema.Array(Schema.String), // "The Story So Far"
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
