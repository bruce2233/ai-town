import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import path from 'path';
import fs from 'fs';

// Helper to wait for a condition
const waitForCondition = async (condition: () => boolean | Promise<boolean>, timeout = 10000, interval = 200) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await condition()) return true;
        await new Promise(r => setTimeout(r, interval));
    }
    return false;
};

describe('E2E Integration: Agent -> Broker -> Client', () => {
    let brokerProcess: ChildProcess;
    let agentProcess: ChildProcess;
    let clientSocket: WebSocket;
    const BROKER_PORT = 8083;
    const WS_URL = `ws://localhost:${BROKER_PORT}`;

    beforeAll(async () => {
        const brokerLog = fs.createWriteStream(path.resolve(__dirname, '../broker.log'));
        const agentLog = fs.createWriteStream(path.resolve(__dirname, '../agent.log'));

        // 1. Start Broker
        const brokerPath = path.resolve(__dirname, '../../broker');
        console.log('Starting Broker from:', brokerPath);
        brokerProcess = spawn('npm', ['run', 'dev'], {
            cwd: brokerPath,
            env: { ...process.env, PORT: BROKER_PORT.toString() }, // Pass PORT
            shell: true
        });
        brokerProcess.stdout?.pipe(brokerLog);
        brokerProcess.stderr?.pipe(brokerLog);

        // Wait for Broker to be ready (listening on port)
        const brokerReady = await waitForCondition(async () => {
            try {
                const ws = new WebSocket(WS_URL);
                return new Promise((resolve) => {
                    ws.on('open', () => {
                        ws.close();
                        resolve(true);
                    });
                    ws.on('error', () => resolve(false));
                });
            } catch {
                return false;
            }
        });

        if (!brokerReady) {
            console.error('Broker failed to start in time.');
            throw new Error('Broker not ready');
        }
        console.log('Broker is ready!');

        // 2. Start Agent
        const agentPath = path.resolve(__dirname, '../../agents');
        console.log('Starting Agent from:', agentPath);
        agentProcess = spawn('npm', ['start'], {
            cwd: agentPath,
            env: { ...process.env, BROKER_URL: WS_URL, AGENT_NAME: 'IntegrationTestAgent' },
            shell: true
        });
        agentProcess.stdout?.pipe(agentLog);
        agentProcess.stderr?.pipe(agentLog);

        // Wait for connection
        await new Promise(r => setTimeout(r, 8000));
    }, 30000); // Increased timeout for process spawning

    afterAll(() => {
        try {
            if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.close();
            }
        } catch (e) {
            console.error('Error closing client socket:', e);
        }

        try {
            if (brokerProcess) {
                if (brokerProcess.pid) process.kill(-brokerProcess.pid); // Kill process group
                brokerProcess.kill();
            }
        } catch (e) {
            console.error('Error killing broke process:', e);
        }

        try {
            if (agentProcess) {
                if (agentProcess.pid) process.kill(-agentProcess.pid);
                agentProcess.kill();
            }
        } catch (e) {
            console.error('Error killing agent process:', e);
        }
    });

    it('should allow an agent to register and communicate', async () => {
        await new Promise<void>((resolve, reject) => {
            clientSocket = new WebSocket(WS_URL);

            clientSocket.on('open', () => {
                // Identify as an observer
                clientSocket.send(JSON.stringify({ type: 'identify', payload: { id: 'Observer' } }));

                // Poll for state every 1s to catch when agents join
                const interval = setInterval(() => {
                    if (clientSocket.readyState === WebSocket.OPEN) {
                        clientSocket.send(JSON.stringify({ type: 'get_state' }));
                    }
                }, 1000);
            });

            // Stop polling when test ends (via cleanup in afterAll, but also good to stop here if resolved)
            // We'll rely on resolve/timeout to finish test.

            const messages: any[] = [];

            clientSocket.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                messages.push(msg);
                console.log('[TEST CLIENT] Received:', msg.type, msg.payload?.type);
            });

            // We expect at least the initial state update
            setTimeout(() => {
                const stateUpdate = messages.find(m => m.type === 'system' && m.payload?.type === 'state_update');
                expect(stateUpdate).toBeDefined();
                const agents = stateUpdate?.payload?.agents || [];
                // Check for Alice (default agent) since agents/index.ts spawns her
                const found = agents.find((a: any) => a.name === 'Alice' || a.id === 'Alice');
                expect(found).toBeDefined();
                resolve();
            }, 8000);

            clientSocket.on('error', (err) => reject(err));
        });
    }, 15000);
});
