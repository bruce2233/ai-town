import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import React from 'react';

// Setup MockWebSocket type for typescript if needed, 
// strictly speaking we cast to any or define interface, 
// for now let's rely on the runtime stub we added in setupTests.ts

describe('App Component', () => {

    it('renders topics correctly and filters invalid ones', async () => {
        render(<App />);

        // We need to access the mock instance that was created by App
        // In setupTests.ts we stubbed WebSocket class.
        // Ideally we want to spy on the instance or have a way to retrieve it.
        // Let's rely on looking up the instance from a global registry if we attached it,
        // OR, we can just spy on the methods if we didn't need the instance reference itself.
        // BUT, to emit events (onmessage), we need the instance that App is listening to.

        // Let's refine the test strategy:
        // We already stubbed global.WebSocket in setupTests.ts.
        // We can assume the App calls `new WebSocket(...)`.
        // We need to capture that instance.

        // We can't easily capture it *after* render unless we had a mechanism.
        // So let's override the stub *locally* in this test to capture it, just like we tried before.

        // Clear mock sockets before test
        (global as any).mockSockets = [];

        // Re-render to trigger useEffect
        // We need to unmount previous? render() does separate tree.
        cleanup();
        render(<App />);

        // Wait for the socket to be captured
        await waitFor(() => {
            expect((global as any).mockSockets.length).toBeGreaterThan(0);
        });

        const mockSocket = (global as any).mockSockets[0];

        // Wait for onmessage assignment
        await waitFor(() => {
            expect(mockSocket.onmessage).toBeTruthy();
        });

        // Simulate connection
        if (mockSocket.onopen) {
            await React.act(async () => {
                mockSocket.onopen();
            });
        }

        // Checking if initial messages were sent
        await waitFor(() => {
            expect(mockSocket.send).toHaveBeenCalled();
        });

        // Simulate receiving bad data (the bug reproduction)
        const badData = {
            type: 'system',
            payload: {
                type: 'state_update',
                topics: ['town_hall', 'finance', 123, { object: true }, 'sports'],
                agents: []
            }
        };

        if (mockSocket.onmessage) {
            await React.act(async () => {
                mockSocket.onmessage({ data: JSON.stringify(badData) } as MessageEvent);
            });
        }

        // Trigger view change to "Topics"
        const topicsNavs = screen.getAllByText('Topics');
        await React.act(async () => {
            topicsNavs[0].click();
        });

        // Verify valid topics
        // Verify valid topics
        await waitFor(() => {
            const headings = screen.getAllByRole('heading', { level: 3 });
            const headingTexts = headings.map(h => h.textContent);

            const hasTownHall = headings.some(h => h.textContent?.normalize().includes('town_hall'));
            expect(hasTownHall).toBe(true);

            const hasFinance = headings.some(h => h.textContent?.normalize().includes('finance'));
            expect(hasFinance).toBe(true);
        });

        // Verify invalid topics are NOT processed/rendered
        expect(screen.queryByText('#123')).not.toBeInTheDocument();

    });
});
