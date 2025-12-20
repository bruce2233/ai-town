import { Effect, Layer, Ref } from "effect";
import { HttpRouter, HttpServer, HttpMiddleware, HttpServerResponse } from "@effect/platform";
import { NodeHttpServer } from "@effect/platform-node";
import { createServer } from "node:http";
import { StateManager } from "./core/state_manager.js";

// Define the Router
const ServerLive = HttpRouter.empty.pipe(
    HttpRouter.get("/api/state", Effect.gen(function* (_) {
        const stateRef = yield* StateManager;
        const state = yield* Ref.get(stateRef);

        if (!state) {
            return yield* HttpServerResponse.json({ error: "Simulation initializing..." }, { status: 503 });
        }

        return yield* HttpServerResponse.json(state);
    })),
    HttpRouter.use(HttpMiddleware.cors({
        allowedOrigins: ["*"], // Allow all for dev
        allowedMethods: ["GET", "OPTIONS", "POST"]
    })),
    HttpServer.serve(HttpMiddleware.logger),
    HttpServer.withLogAddress
);

// Define the Node Server Layer
const NodeServerLive = NodeHttpServer.layer(createServer, { port: 3000 });

// Combine into a single exported Layer
export const ApiServerLive = ServerLive.pipe(
    Layer.provide(NodeServerLive)
);
