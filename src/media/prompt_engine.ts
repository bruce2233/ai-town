import { Effect, Context } from "effect";
import { Event, GlobalState } from "../core/index.js";
import { MediaPrompt, AssetType } from "./model.js";

// ---------------------------------------------
// Prompt Engine Service
// ---------------------------------------------

export class PromptEngine extends Context.Tag("PromptEngine")<
    PromptEngine,
    {
        generatePrompts: (
            event: Event,
            state: GlobalState
        ) => Effect.Effect<ReadonlyArray<MediaPrompt>>;
    }
>() { }

// ---------------------------------------------
// Basic Implementation
// ---------------------------------------------

export const PromptEngineLive = Effect.succeed(
    PromptEngine.of({
        generatePrompts: (event, state) =>
            Effect.gen(function* (_) {
                const prompts: MediaPrompt[] = [];

                if (event.type === "AGENT_MOVED") {
                    const payload = event.payload as any;
                    const agent = state.agents[payload.agentId];
                    const location = state.locations[payload.to];

                    if (agent && location) {
                        // Generate IMAGE prompt for the scene
                        prompts.push({
                            id: `prompt_${event.id}_img`,
                            assetType: "IMAGE",
                            promptText: `Pixel art of ${agent.name} (${agent.description}) walking in ${location.name} (${location.description}).`,
                            context: { agentId: agent.id, locationId: location.id }
                        });

                        // Generate MUSIC prompt for the location ambience
                        prompts.push({
                            id: `prompt_${event.id}_music`,
                            assetType: "AUDIO_MUSIC",
                            promptText: `Background music for ${location.name}: ${location.description}`,
                            context: { locationId: location.id }
                        });
                    }
                }

                return prompts;
            }),
    })
);
