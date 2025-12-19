import { Schema } from "effect";
import { AgentId, GlobalState } from "./model.js";

// ---------------------------------------------
// View (Projected State)
// ---------------------------------------------

export const AgentView = Schema.Struct({
    description: Schema.String,
    // We still keep the structured state for safety/cheating if needed,
    // but the Agent should primarily use description
    rawData: GlobalState,
});
export type AgentView = Schema.Schema.Type<typeof AgentView>;

// ---------------------------------------------
// Projection Function ($\pi$)
// ---------------------------------------------

export const project = (state: GlobalState, agentId: AgentId): AgentView => {
    const agent = state.agents[agentId];
    if (!agent) {
        return {
            description: "You do not exist.",
            rawData: state,
        };
    }

    const location = state.locations[agent.locationId];
    // Simple heuristic text generation for now (could be LLM powered later too!)
    const description = `You are ${agent.name} (${agent.description}). 
You are currently at ${location ? location.name : "Unknown"} (${location ? location.description : ""
        }).
Current Tick: ${state.tick}.`;

    return { description, rawData: state };
};
