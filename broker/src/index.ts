import { Broker, Message } from './Broker';

const PORT = 8080;
const broker = new Broker(PORT);

// --- Timeline Service ---
// Simple logger that captures all non-system events
broker.on('message', (msg: Message) => {
    // Filter out heartbeats and state updates if they spam
    if (msg.topic === 'system:status') return;

    // In a real app, we would write to DB here
    console.log(`[TIMELINE] ${msg.timestamp ? new Date(msg.timestamp).toISOString() : ''} [${msg.topic}] ${msg.sender}:`,
        typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload).substring(0, 100));
});

// --- Analyst Service ---
// Analyzes messages and takes action (e.g. forwarding)
broker.on('message', (msg: Message) => {
    // Avoid loops and system messages
    if (msg.sender === 'system' || msg.sender === 'analyst') return;
    if (msg.topic === 'system:status') return;

    let content = '';
    if (typeof msg.payload === 'string') {
        content = msg.payload;
    } else if (msg.payload?.content && typeof msg.payload.content === 'string') {
        content = msg.payload.content;
    }

    if (!content) return;

    // Logic: Look for "to: topic <name>"
    const topicMatch = content.match(/to:\s*(?:topic\s+)?([a-zA-Z0-9_:.-]+)/i);

    if (topicMatch && topicMatch[1]) {
        const targetTopic = topicMatch[1];
        console.log(`[ANALYST] Detected forwarding request from ${msg.sender} to ${targetTopic}`);

        // Use internalPublish to send as a system-level agent
        broker.internalPublish(targetTopic, `[Forwarded from ${msg.sender}]: ${content}`, 'analyst');
    }
});

broker.start();
