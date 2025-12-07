import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import path from 'path';
import fs from 'fs';

const BROKER_PORT = 8084;
const BROKER_URL = `ws://localhost:${BROKER_PORT}`;
const BROKER_DIR = path.resolve(__dirname, '../../broker');
const AGENTS_DIR = path.resolve(__dirname, '../../agents');

describe('End-to-End Integration', () => {
    let brokerProcess: ChildProcess;
    let agentProcess: ChildProcess;
    let clientSocket: WebSocket;

    beforeAll(async () => {
        // 1. Start Broker
        brokerProcess = spawn('npm', ['run', 'dev'], {
            cwd: BROKER_DIR,
            env: { ...process.env, PORT: BROKER_PORT.toString() },
            shell: true,
            stdio: 'pipe' // Capture output for debugging
        });

        // Pipe logs to file for debugging
        const brokerLog = fs.createWriteStream('broker.log');
        brokerProcess.stdout?.pipe(brokerLog);
        brokerProcess.stderr?.pipe(brokerLog);

        console.log('Waiting for Broker to start...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 2. Start Agents
        agentProcess = spawn('npm', ['start'], {
            cwd: AGENTS_DIR,
            env: {
                ...process.env,
                BROKER_URL: BROKER_URL,
                LLM_API_URL: 'http://localhost:8081/v1', // Assuming Gateway is running or mocked, but agents might not need it for connect
                OPENAI_API_KEY: 'dummy'
            },
            shell: true,
            stdio: 'pipe'
        });

        const agentLog = fs.createWriteStream('agent.log');
        agentProcess.stdout?.pipe(agentLog);
        agentProcess.stderr?.pipe(agentLog);

        console.log('Waiting for Agents to connect...');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }, 30000);

    afterAll(() => {
        if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
            clientSocket.close();
        }

        // Kill processes tree
        try {
            if (brokerProcess.pid) process.kill(-brokerProcess.pid, 'SIGKILL');
        } catch (e) {
            // Ignore if process is already dead
        }        // Using tree kill approach or simple kill:
        try { brokerProcess.kill(); } catch (e) { }
        try { agentProcess.kill(); } catch (e) { }
    });

    it('Frontend should receive messages from Agents via Broker', async () => {
        const receivedMessages: any[] = [];

        await new Promise<void>((resolve, reject) => {
            clientSocket = new WebSocket(BROKER_URL);

            clientSocket.on('open', () => {
                console.log('Frontend Client connected');
                // Simulate App.tsx identity and subscription
                clientSocket.send(JSON.stringify({ type: 'identify', payload: { id: 'Observer' } }));
                clientSocket.send(JSON.stringify({ type: 'subscribe', topic: '*' })); // Firehose
            });

            clientSocket.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                receivedMessages.push(msg);

                // Check if we received a chat message from an agent
                if (msg.type === 'message' && msg.sender && msg.sender !== 'Observer') {
                    console.log('Received Agent Message:', msg);
                    resolve();
                }
            });

            clientSocket.on('error', (err) => {
                reject(err);
            });

            // Timeout if no message received
            setTimeout(() => {
                if (receivedMessages.length > 0) resolve(); // Resolve if we got *something* at least
                else reject(new Error('Timeout: No messages received from agents'));
            }, 15000);
        });

        expect(receivedMessages.length).toBeGreaterThan(0);
        const agentMsg = receivedMessages.find(m => m.type === 'message' && m.sender !== 'Observer');
        expect(agentMsg).toBeDefined();
        // expect(agentMsg.topic).toBe('town_hall'); // Might be private topic
    }, 20000);
});
