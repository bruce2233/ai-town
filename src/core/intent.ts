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

export const Intent = Schema.Union(MoveIntent, SpeakIntent);
export type Intent = Schema.Schema.Type<typeof Intent>;

export type MoveIntent = Schema.Schema.Type<typeof MoveIntent>;
export type SpeakIntent = Schema.Schema.Type<typeof SpeakIntent>;
