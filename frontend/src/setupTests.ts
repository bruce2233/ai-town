import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock WebSocket globally
// Queue of created sockets
(global as any).mockSockets = [];

class MockWebSocket {
    send = vi.fn();
    close = vi.fn();
    onopen: any = null;
    onmessage: any = null;
    onclose: any = null;
    readyState = 1; // OPEN
    url: string;

    constructor(url: string) {
        console.log('MockWebSocket created for URL:', url);
        this.url = url;
        (global as any).mockSockets.push(this);
        // Store instance for tests to access if needed, 
        // or we can rely on `vi.spyOn` in tests if we want more control.
        // For now, this class instance will be returned.
    }
}

vi.stubGlobal('WebSocket', MockWebSocket);
