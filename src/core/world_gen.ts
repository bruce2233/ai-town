import { Effect } from "effect";
import { LLMService } from "./llm.js";
import { GlobalState, AgentId, LocationId } from "./model.js";

export interface WorldGenOptions {
    theme: string;
    language: string;
    agentCount: number;
}

export const generateWorld = (options: WorldGenOptions): Effect.Effect<GlobalState, Error, LLMService> =>
    Effect.gen(function* (_) {
        const llm = yield* LLMService;
        const { theme, language, agentCount } = options;

        const prompt = `
You are a creative world builder for a simulation game.
Task: Generate a JSON object representing the initial state of a small town based on the following parameters:
- Theme: ${theme}
- Language: ${language} (All names and descriptions MUST be in this language)
- Number of Agents: ${agentCount}

Requirements:
1. Create ${agentCount} unique agents with names, personalities (description), and initial "Idle" status.
2. Create 3-5 unique locations fitting the theme.
3. Generate a brief initial history (narrative intro).

IMPORTANT:
- Keep descriptions SHORT (one sentence).
- Return ONLY valid JSON.
- Do NOT include markdown formatting.
- Ensure the JSON is complete and valid.

Output JSON Format:
{
  "agents": [
    { "id": "agent_1", "name": "...", "description": "...", "locationId": "loc_1" }
  ],
  "locations": [
    { "id": "loc_1", "name": "...", "description": "..." }
  ],
  "history": ["...initial narrative..."]
}

Returns ONLY valid JSON. Do not include markdown formatting.
`;

        const rawJson = yield* llm.generateCompletion(prompt);
        // Basic cleanup in case LLM adds markdown checks
        const cleanJson = rawJson.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            return yield* Effect.fail(new Error(`Failed to parse World Gen JSON: ${cleanJson}`));
        }

        // Map parsed data to GlobalState structure
        const agents: Record<AgentId, any> = {};
        parsed.agents.forEach((a: any) => {
            agents[a.id as AgentId] = {
                id: a.id as AgentId,
                name: a.name,
                description: a.description,
                locationId: a.locationId as LocationId,
                status: "Idle",
                memory: {}
            };
        });

        const locations: Record<LocationId, any> = {};
        parsed.locations.forEach((l: any) => {
            locations[l.id as LocationId] = {
                id: l.id as LocationId,
                name: l.name,
                description: l.description
            };
        });

        let history = parsed.history || ["Simulation started."];
        if (typeof history === "string") {
            history = [history];
        }

        const state: GlobalState = {
            tick: 0,
            agents,
            locations,
            history
        };

        return state;
    });
