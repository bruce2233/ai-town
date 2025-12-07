import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import React from 'react';

type MockWebSocket = {
    onopen: (() => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    send: (data: string) => void;
    close: () => void;
};

describe('App Component', () => {

    it('renders topics correctly and filters invalid ones', async () => {
        render(<App />);

        // We need to access the mock instance that was created by App
        // In setupTests.ts we stubbed WebSocket class.
        // Ideally we want to spy on the instance or have a way to retrieve it.
        // Let's rely on looking up the instance from a global registry if we attached it,
        // OR, we can just spy on the methods if we didn't need the instance reference itself.
        // BUT, to emit events (onmessage), we need the instance that App is listening to.
        // Clear mock sockets before test
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).mockSockets = [];

        // Re-render to trigger useEffect
        // We need to unmount previous? render() does separate tree.
        cleanup();
        render(<App />);

        // Wait for connection (App connects on mount)
        // Access global mock socket

        // Wait for the socket to be captured
        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((globalThis as any).mockSockets.length).toBeGreaterThan(0);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockSocket = (globalThis as any).mockSockets[0] as MockWebSocket;

        // Wait for onmessage assignment
        await waitFor(() => {
            expect(mockSocket.onmessage).toBeTruthy();
        });

        // Simulate receiving bad data (the bug reproduction)
        const badData = {
            type: 'system',
            payload: {
                type: 'state_update',
                topics: [
                    'town_hall',
                    'finance', // valid
                    123,       // invalid (number)
                    { object: true }, // invalid (object)
                    'sports'   // valid
                ],
                agents: [],
                events: []
            }
        };

        // Simulate incoming message
        // We need to act() because this updates state
        if (mockSocket.onmessage) {
            await React.act(async () => {
                mockSocket.onmessage!({ data: JSON.stringify(badData) } as MessageEvent);
            });
        }

        // Trigger view change to "Topics"
        // Use getByRole which is more precise than getAllByText
        const topicsBtn = screen.getByRole('button', { name: 'Topics' });
        await React.act(async () => {
            fireEvent.click(topicsBtn);
        });

        // Verify valid topics
        // Assert valid topics are present
        await waitFor(() => {
            const headings = screen.getAllByRole('heading', { level: 3 });

            const hasTownHall = headings.some(h => h.textContent?.normalize().includes('town_hall'));
            expect(hasTownHall).toBe(true);

            const hasFinance = headings.some(h => h.textContent?.normalize().includes('finance'));
            expect(hasFinance).toBe(true);
        });

        // Verify invalid topics are NOT processed/rendered
        expect(screen.queryByText('#123')).not.toBeInTheDocument();

    });

    it('renders incoming chat messages', async () => {
        render(<App />);

        // Clear mock sockets before test
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).mockSockets = [];
        cleanup();
        render(<App />);

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((globalThis as any).mockSockets.length).toBeGreaterThan(0);
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mockSocket = (globalThis as any).mockSockets[0] as MockWebSocket;

        await waitFor(() => {
            expect(mockSocket.onmessage).toBeTruthy();
        });

        const chatMsg = {
            type: 'message',
            sender: 'Alice',
            payload: 'Hello World',
            timestamp: Date.now()
        };

        if (mockSocket.onmessage) {
            await React.act(async () => {
                mockSocket.onmessage!({ data: JSON.stringify(chatMsg) } as MessageEvent);
            });
        }

        // screen.debug(); 

        // Use findByText which includes retry logic, avoiding manual waitFor
        const msg = await screen.findByText('Hello World');
        expect(msg).toBeInTheDocument();

        // Alice appers in sidebar and message, so we expect multiple
        const senders = await screen.findAllByText('Alice');
        expect(senders.length).toBeGreaterThan(0);
    });
});
