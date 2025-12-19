import { Effect, Console } from "effect";
import { GlobalState, AgentId, LocationId, AgentState, project, LLMService, LLMServiceLive } from "./core/index.js";
import { createEngine } from "./engine/index.js";
import { createLLMAgent } from "./agents/index.js";
import { PromptEngineLive, AssetManagerMock } from "./media/index.js";

// ---------------------------------------------
// MVP CLI (LLM Powered)
// ---------------------------------------------

const runSimulation = Effect.gen(function* (_) {
    yield* Console.log("Initializing AI Town (LLM Powered)...");

    // 1. Initialize State
    let state: GlobalState = {
        tick: 0,
        agents: {
            ["agent_1" as AgentId]: {
                id: "agent_1" as AgentId,
                name: "Alice",
                description: "A wanderer looking for secrets.",
                locationId: "loc_0" as LocationId,
                memory: {},
            },
            ["agent_2" as AgentId]: {
                id: "agent_2" as AgentId,
                name: "Bob",
                description: "A merchant looking for customers.",
                locationId: "loc_1" as LocationId,
                memory: {},
            },
        },
        locations: {
            ["loc_0" as LocationId]: { id: "loc_0" as LocationId, name: "Home", description: "Sweet home" },
            ["loc_1" as LocationId]: { id: "loc_1" as LocationId, name: "Park", description: "Green grass" },
            ["loc_2" as LocationId]: { id: "loc_2" as LocationId, name: "Shop", description: "Buy things" },
            ["loc_3" as LocationId]: { id: "loc_3" as LocationId, name: "Forest", description: "Dark trees" },
            ["loc_4" as LocationId]: { id: "loc_4" as LocationId, name: "Lake", description: "Blue water" }
        }
    };

    // Create dependencies
    const agent1 = yield* createLLMAgent("agent_1" as AgentId);
    const agent2 = yield* createLLMAgent("agent_2" as AgentId);
    const agents = [agent1, agent2];

    const promptEngine = yield* PromptEngineLive;
    const assetManager = yield* AssetManagerMock;
    const engine = yield* createEngine();

    // 2. Game Loop (5 ticks)
    for (let i = 0; i < 5; i++) {
        yield* Console.log(`\n--- Tick ${state.tick} ---`);

        const intents = [];
        for (const agent of agents) {
            // 2a. Projection (Text Description)
            const view = project(state, agent.id);

            // 2b. Policy (LLM Decision)
            const intent = yield* agent.act(view);
            intents.push(intent);
            yield* Console.log(`Agent ${agent.id} decided to ${intent._tag} to ${(intent as any).targetLocationId || '?'}`);
        }

        // 2c. Resolution (LLM DM)
        const result = yield* engine.resolve(intents, state);
        state = result.state;

        // 2d. Events & Media Generation
        for (const event of result.events) {
            yield* Console.log(`EVENT: ${event.type} -> ${JSON.stringify(event.payload)}`);

            // Generate Prompts from Event
            const prompts = yield* promptEngine.generatePrompts(event, state);
            for (const prompt of prompts) {
                yield* Console.log(`  -> GEN_PROMPT [${prompt.assetType}]: ${prompt.promptText}`);

                // Generate Asset
                const asset = yield* assetManager.generateAsset(prompt);
                yield* Console.log(`  -> ASSET_READY: ${asset.url}`);
            }
        }
    }

    yield* Console.log("\nSimulation finished.");
});

// Provide the Mock Service to the Main Effect
// Provide the Mock Service to the Main Effect
Effect.runPromise(runSimulation.pipe(Effect.provideServiceEffect(LLMService, LLMServiceLive)));
