import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock WebSocket globally
// Queue of created sockets
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).mockSockets = [];

class MockWebSocket {
    send = vi.fn();
    close = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onopen: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onmessage: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onclose: any = null;
    readyState = 1; // OPEN
    url: string;

    constructor(url: string) {
        console.log('MockWebSocket created for URL:', url);
        this.url = url;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).mockSockets.push(this);
    }
}

vi.stubGlobal('WebSocket', MockWebSocket);
