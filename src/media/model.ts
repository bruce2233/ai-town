import { Schema } from "effect";

// ---------------------------------------------
// Media Types
// ---------------------------------------------

export const AssetType = Schema.Literal("IMAGE", "AUDIO_TTS", "AUDIO_MUSIC");
export type AssetType = Schema.Schema.Type<typeof AssetType>;

export const MediaPrompt = Schema.Struct({
    id: Schema.String,
    assetType: AssetType,
    promptText: Schema.String,
    // Metadata for context (e.g. which agent, location)
    context: Schema.Record({ key: Schema.String, value: Schema.String }),
});
export type MediaPrompt = Schema.Schema.Type<typeof MediaPrompt>;

export const GeneratedAsset = Schema.Struct({
    id: Schema.String,
    promptId: Schema.String,
    assetType: AssetType,
    url: Schema.String, // Local file path or Remote URL
});
export type GeneratedAsset = Schema.Schema.Type<typeof GeneratedAsset>;
