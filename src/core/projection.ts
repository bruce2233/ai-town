import { Effect, Schema } from "effect";
import { AgentId, GlobalState } from "./model.js";
import { LLMService } from "./llm.js";

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
// Projection Function ($\pi$) - LLM Powered
// ---------------------------------------------

export const project = (state: GlobalState, agentId: AgentId): Effect.Effect<AgentView, Error, LLMService> =>
    Effect.gen(function* (_) {
        const agent = state.agents[agentId];
        if (!agent) {
            return { description: "You do not exist.", rawData: state };
        }

        const llm = yield* LLMService;

        // Construct a holistic prompt with the ENTIRE state (filtered mainly by token limits if needed, but requested to satisfy "NO Physical Filtering")
        // We provide a JSON dump of relevant info and ask the LLM to narrate the perspective.

        const context = {
            you: { name: agent.name, description: agent.description, status: agent.status, locationId: agent.locationId },
            locations: state.locations,
            all_agents: state.agents,
            tick: state.tick
        };

        const prompt = `
You are the perception system for an AI Agent named "${agent.name}".
You are currently functioning as their eyes and ears.

World State (JSON):
${JSON.stringify(context, null, 2)}

Task:
Describe what "${agent.name}" sees and hears right now. 
- You are at ${state.locations[agent.locationId]?.name || "Unknown"}.
- Report ONLY what is naturally visible/audible from this location. 
- If other agents are in the SAME location, describe them.
- If other agents are elsewhere, you generally CANNOT see them unless they are very close or loud.
- Be immersive and descriptive (First Person perspective).

Format:
Just the natural language description.
`;

        const description = yield* llm.generateCompletion(prompt);

        return { description, rawData: state };
    });
