import { Effect, Console } from "effect";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { GlobalState, AgentId } from "./core/model.js";
import { ActionIntent } from "./core/intent.js";
import { createEngine } from "./engine/index.js";
import { createLLMAgent } from "./agents/index.js";
import { project } from "./core/projection.js";
import { LLMService, LLMServiceLive, LLMServiceMock } from "./core/llm.js";
import { generateWorld } from "./core/world_gen.js";

// ---------------------------------------------
// AI Town Simulation Loop
// ---------------------------------------------

const runSimulation = (initialState: GlobalState) => Effect.gen(function* (_) {
    yield* Console.log("Initializing AI Town (LLM Powered)...");

    // Engine is already Effect<ResolutionEngine...>, wait, createEngine return Engine directly or Effect?
    // According to resolution.test.ts: createEngine() returns Effect<ResolutionEngine>
    const engine = yield* createEngine();
    let state = initialState;

    // Create Agents
    // createLLMAgent returns Effect<Agent, never, LLMService>.
    const agentInstances = yield* Effect.all(
        Object.keys(state.agents).map(id => createLLMAgent(id as AgentId))
    );

    // Simulation Loop
    for (let i = 0; i < 5; i++) {
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
                // Explicitly cast to ActionIntent if TS isn't narrowing automatically for some reason in this context
                // The union is discriminated by _tag, it should work.
                // But let's be safe.
                const action = intent as ActionIntent;
                yield* Console.log(`Agent ${agent.id} decided to: "${action.instruction}"`);
            } else {
                yield* Console.log(`Agent ${agent.id} decided to: "${intent._tag}"`);
            }
        }

        // 3. Resolution (State Update)
        const result = yield* engine.resolve(intents, state);
        state = result.state;
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
const LLMProvider = useMock ? LLMServiceMock : LLMServiceLive;

console.log(`Using ${useMock ? "MOCK" : "REAL"} LLM Service.`);

Effect.runPromise(program.pipe(Effect.provideServiceEffect(LLMService, LLMProvider), Effect.orDie));
