import { Effect, Console, Layer, Ref } from "effect";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { GlobalState, AgentId } from "./core/model.js";
import { ActionIntent } from "./core/intent.js";
import { createEngine } from "./engine/index.js";
import { createLLMAgent } from "./agents/index.js";
import { project } from "./core/projection.js";
import { LLMService, LLMServiceLive, LLMServiceMock } from "./core/llm.js";
import { generateWorld } from "./core/world_gen.js";
import { ApiServerLive } from "./server.js";
import { StateManager, StateManagerLive } from "./core/state_manager.js";
import { NodeRuntime } from "@effect/platform-node";

// ---------------------------------------------
// AI Town Simulation Loop
// ---------------------------------------------

const runSimulation = (initialState: GlobalState) => Effect.gen(function* (_) {
    yield* Console.log("Initializing AI Town (LLM Powered)...");

    const engine = yield* createEngine();
    let state = initialState;

    // Create Agents
    const agentInstances = yield* Effect.all(
        Object.keys(state.agents).map(id => createLLMAgent(id as AgentId))
    );

    // Simulation Loop (Infinite)
    let i = 0;
    while (true) {
        i++;
        yield* Console.log(`\n--- Tick ${state.tick} ---`);
        if (state.history.length > 0) {
            yield* Console.log(`NARRATIVE: ${state.history[state.history.length - 1]}`);
        }

        const intents = [];
        for (const agent of agentInstances) {
            // 2a. Projection (Text Description)
            const view = yield* project(state, agent.id);

            // 2b. Policy (LLM Decision)
            const intent = yield* agent.act(view);
            intents.push(intent);

            if (intent._tag === "Action") {
                const action = intent as ActionIntent;
                yield* Console.log(`Agent ${agent.id} decided to: "${action.instruction}"`);
            } else {
                yield* Console.log(`Agent ${agent.id} decided to: "${intent._tag}"`);
            }
        }

        // 3. Resolution (State Update)
        const result = yield* engine.resolve(intents, state);
        state = result.state;

        // Push update to usage StateManager
        const stateRef = yield* StateManager;
        yield* Ref.set(stateRef, state);
    }

    yield* Console.log("\nSimulation finished.");
    return state;
});

// ---------------------------------------------
// MVP CLI (LLM Powered)
// ---------------------------------------------

const program = Effect.gen(function* (_) {
    // CLI Interaction
    const rl = createInterface({ input, output });

    yield* Console.log(`
╔════════════════════════════════════════╗
║         AI TOWN SIMULATION             ║
╚════════════════════════════════════════╝
`);

    const language = yield* Effect.tryPromise(() => rl.question("Language (default: English): ")).pipe(
        Effect.map((ans: any) => (ans as string).trim() || "English")
    );
    const theme = yield* Effect.tryPromise(() => rl.question("Theme (default: Standard): ")).pipe(
        Effect.map((ans: any) => (ans as string).trim() || "Standard Town")
    );
    const countStr = yield* Effect.tryPromise(() => rl.question("Agent Count (default: 3): ")).pipe(
        Effect.map((ans: any) => (ans as string).trim() || "3")
    );
    const agentCount = parseInt(countStr) || 3;

    rl.close();

    yield* Console.log(`\nGenerating World (${theme}, ${language}, ${agentCount} agents)... Please wait...`);

    // Generate Initial State
    const initialState = yield* generateWorld({ theme, language, agentCount });

    yield* Console.log("World Generated Successfully!");

    return yield* runSimulation(initialState);
});

const useMock = process.env.USE_MOCK === "true";
// Convert LLM Effect Service to Layer
const LLMLayer = Layer.effect(
    LLMService,
    useMock ? LLMServiceMock : LLMServiceLive
);

console.log(`Using ${useMock ? "MOCK" : "REAL"} LLM Service.`);

// Compose Layers:
// 1. BaseLayer = LLM + StateManager (Shared)
const BaseLayer = Layer.merge(LLMLayer, StateManagerLive);

// 2. ApiServer needs StateManager (from BaseLayer)
// 3. Program needs StateManager + LLM (from BaseLayer)
// So we merge ApiServer (with dependencies satisfied) and BaseLayer.
const MainLayer = ApiServerLive.pipe(
    Layer.provide(BaseLayer),
    Layer.merge(BaseLayer)
);

NodeRuntime.runMain(program.pipe(
    Effect.provide(MainLayer)
));
