import { Effect, Context, Schedule } from "effect";
import { MediaPrompt, GeneratedAsset } from "./model.js";

// ---------------------------------------------
// Asset Manager Service
// ---------------------------------------------

export class AssetManager extends Context.Tag("AssetManager")<
    AssetManager,
    {
        generateAsset: (prompt: MediaPrompt) => Effect.Effect<GeneratedAsset>;
    }
>() { }

// ---------------------------------------------
// Mock Implementation
// ---------------------------------------------

export const AssetManagerMock = Effect.succeed(
    AssetManager.of({
        generateAsset: (prompt) =>
            Effect.gen(function* (_) {
                // Simulate API latency
                yield* Effect.sleep("100 millis");

                return {
                    id: `asset_${Math.random().toString(36).substring(7)}`,
                    promptId: prompt.id,
                    assetType: prompt.assetType,
                    url: `assets/${prompt.assetType.toLowerCase()}/${prompt.id}.png` // Fake URL
                };
            }),
    })
);
