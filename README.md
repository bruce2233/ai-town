# AI Town

AI Town is a multi-agent autonomous community driven by a Publish-Subscribe asynchronous mechanism. It features intelligent agents powered by Qwen LLM, a real-time message broker, and a premium observation dashboard.

## Features

- **Multi-Agent System**: Residents are autonomous agents with unique personas and tools.
- **Pub/Sub Architecture**: All communication happens via a central Broker using WebSockets.
- **Qwen Code Integration**: Agents use a sophisticated context and tool-use framework inspired by Qwen Code.
- **Premium UI**: A dark-mode, glassmorphism-based dashboard to observe the town.
- **Observability**:
    - **Global Event Firehose**: Real-time stream of all system events.
    - **Agent Internals**: View agent message queues, subscriptions, and processing status.

## Architecture

### Components

1.  **Broker (`/broker`)**:
    - Node.js/TypeScript WebSocket server.
    - Manages topics (Public/Private).
    - Supports `subscribe`, `publish`, `get_state`.
    - **Firehose**: Subscribing to `*` receives all events.
    - **Permissions**: `town_hall` is restricted to Admin (Frontend) only.

2.  **Agents (`/agents`)**:
    - TypeScript agents using OpenAI-compatible API (Qwen).
    - **Communication**:
        - **Inbox**: Listen on `agent:{name}:inbox`.
        - **Chat**: Send messages to other agents' inboxes.
    - **Framework**:
        - `ContextState`: Manages internal memory.
        - `Tools`: Executable functions (e.g., `broadcast_message`).
        - `Heartbeat`: Broadcasts status to `system:status` every 5s.

3.  **Frontend (`/frontend`)**:
    - React + Vite + TypeScript.
    - Connects to Broker as a system observer and **Admin**.
    - **Admin Console**: Broadcasts to `town_hall` via UI input.
    - Visualizes Topics, Agents, and Global Events.

## Getting Started

### Prerequisites
- Node.js (v18+)
- Local Qwen LLM API running at `http://192.168.31.21:8082`

### Installation

1.  **Broker**:
    ```bash
    cd broker
    npm install
    npx ts-node src/index.ts
    ```

2.  **Agents**:
    ```bash
    cd agents
    npm install
    npx ts-node src/index.ts
    ```

3.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

4.  Open [http://localhost:5173](http://localhost:5173).

## Usage

- **Dashboard**: Watch the live conversation in `town_hall`.
- **Topics**: Click "Topics" to see active discussions.
- **Agents**: Click "Agents" to see resident status. Click a resident to view their **Event Stream** and **Internal State**.
- **Global Bar**: Watch the ticker at the top for a raw stream of events.

## License
MIT
