import { Effect, Context, Schema } from "effect";

// ---------------------------------------------
// LLM Service Interface
// ---------------------------------------------

export class LLMService extends Context.Tag("LLMService")<
    LLMService,
    {
        generateCompletion: (
            prompt: string
        ) => Effect.Effect<string, Error>;

        generateJson: <A>(
            prompt: string,
            schema: Schema.Schema<A>
        ) => Effect.Effect<A, Error>;
    }
>() { }

// ---------------------------------------------
// Real Implementation (Qwen3)
// ---------------------------------------------

const fetchCompletion = (prompt: string, jsonMode: boolean = false) =>
    Effect.tryPromise({
        try: async () => {
            const messages = [
                {
                    role: "system", content: jsonMode
                        ? "You are an AI assistant. Output VALID JSON ONLY. No markdown code blocks."
                        : "You are a helpful AI assistant controlling an agent in a simulated town. High quality roleplay."
                },
                { role: "user", content: prompt }
            ];

            console.log(`[Real LLM] Requesting: ${prompt.substring(0, 50)}...`);
            const response = await fetch("http://192.168.31.21:8082/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "/home/zyp/app/data/Qwen3-4B-Instruct-2507-AWQ-4bit/",
                    messages,
                    temperature: jsonMode ? 0.2 : 0.7,
                    max_tokens: 2048 // Increased for JSON generation
                }),
            });

            if (!response.ok) {
                throw new Error(`LLM API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            return data.choices[0].message.content.trim() as string;
        },
        catch: (e) => new Error(`LLM Network Error: ${String(e)}`)
    });

export const LLMServiceLive = Effect.succeed(
    LLMService.of({
        generateCompletion: (prompt) => fetchCompletion(prompt, false),

        generateJson: (prompt, schema) =>
            Effect.gen(function* (_) {
                const textResult = yield* fetchCompletion(prompt, true);

                // Basic cleaning of JSON (remove markdown ```json ... ```)
                const cleanJson = textResult.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();

                try {
                    const parsed = JSON.parse(cleanJson);
                    // TODO: decoding using the schema
                    return parsed;
                } catch (e) {
                    return yield* Effect.fail(new Error(`Failed to parse JSON from LLM: ${cleanJson}`));
                }
            }),
    })
);

// ---------------------------------------------
// Mock Implementation (Simulated Intelligence)
// ---------------------------------------------

export const LLMServiceMock = Effect.succeed(
    LLMService.of({
        generateCompletion: (prompt) =>
            Effect.gen(function* (_) {
                yield* Effect.sleep("100 millis"); // Simulate thinking
                return "Thinking process... Mock response.";
            }),

        generateJson: (prompt, schema) =>
            Effect.gen(function* (_) {
                yield* Effect.sleep("100 millis");
                // In a real implementation, we would call an API and parse the JSON.
                // Here we just return a valid mock based on the schema if possible,
                // or specific logic for known prompts.

                // This mock needs to be tailored for specific calls in our MVP
                // or we can use a library like 'fast-check' to generate arbitrary data,
                // but for now let's just log and fail if not handled manually in the calling code
                // or return a stub.

                return {} as any; // DANGEROUS MOCK: Caller must handle or Mock needs to be smarter
            }),
    })
);
