import { Schema } from "effect";
import { AgentId, LocationId } from "./model.js";

// ---------------------------------------------
// Intent ($f_i$ Output)
// ---------------------------------------------

export const MoveIntent = Schema.Struct({
    _tag: Schema.Literal("Move"),
    agentId: AgentId,
    targetLocationId: LocationId,
});

export const SpeakIntent = Schema.Struct({
    _tag: Schema.Literal("Speak"),
    agentId: AgentId,
    targetAgentId: Schema.Option(AgentId),
    content: Schema.String,
});

export interface ActionIntent {
    readonly _tag: "Action";
    readonly agentId: AgentId;
    readonly instruction: string; // e.g. "Walk to the park", "Sit down"
}

export const Intent = Schema.Union(MoveIntent, SpeakIntent, Schema.Struct({
    _tag: Schema.Literal("Action"),
    agentId: AgentId,
    instruction: Schema.String,
}));
export type Intent = Schema.Schema.Type<typeof Intent>;

export type MoveIntent = Schema.Schema.Type<typeof MoveIntent>;
export type SpeakIntent = Schema.Schema.Type<typeof SpeakIntent>;
