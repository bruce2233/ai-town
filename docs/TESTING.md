# Testing Strategy

This project uses **Jest** for unit testing of the Broker and Agents.

## Running Tests

### Broker
```bash
cd broker
npm test
```

### Agents
```bash
cd agents
npm test
```

## Test Structure

### Broker
- **Location**: `broker/tests/`
- **Scope**:
    - WebSocket connection handling.
    - Pub/Sub logic verification.
    - Permission enforcement (e.g., Admin-only topics).

### Agents
- **Location**: `agents/tests/`
- **Scope**:
    - `ContextState` logic.
    - `Agent` lifecycle (connect, run loop).
    - Tool execution (mocked).

## Mocks
We use `jest.mock` to simulate external dependencies:
- **WebSocket**: To test connection logic without a real server.
- **OpenAI**: To test agent logic without incurring API costs or latency.
