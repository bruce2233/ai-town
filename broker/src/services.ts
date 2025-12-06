import { Broker, Message } from './Broker';

// --- Timeline Service ---
export function setupTimeline(broker: Broker) {
    // Simple logger that captures all non-system events
    broker.on('message', (msg: Message) => {
        // Filter out heartbeats and state updates if they spam
        if (msg.topic === 'system:status') return;

        // In a real app, we would write to DB here
        console.log(`[TIMELINE] ${msg.timestamp ? new Date(msg.timestamp).toISOString() : ''} [${msg.topic}] ${msg.sender}:`,
            typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload).substring(0, 100));
    });
}

// --- Analyst Service ---
export function setupAnalyst(broker: Broker) {
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

        // Logic: Look for ">>> TO: <topic_name>"
        // Regex: >>> TO: (anything not newline)
        const topicMatch = content.match(/>>> TO: (\S+)/i); // Expect topic to be a single word (no spaces)

        if (topicMatch) {
            const targetTopic = topicMatch[1].trim();
            const directive = topicMatch[0];

            // Basic validation: Topic should not be empty and shouldn't contain invalid chars if we had rules
            // Ideally we check if topic exists, but that's harder without state. 

            // Remove the directive from content to clean it up
            const cleanContent = content.replace(directive, '').trim();

            if (!cleanContent) {
                // Empty content, maybe an accidental send? 
                broker.internalPublish(`agent:${msg.sender}:inbox`, `[System Error]: You tried to send to ${targetTopic} but the message content was empty.`, 'system');
                return;
            }

            console.log(`[ANALYST] Detected forwarding request from ${msg.sender} to ${targetTopic}`);

            // Use internalPublish to send as a system-level agent
            broker.internalPublish(targetTopic, cleanContent, msg.sender);
        } else {
            // Check for "near miss" - e.g. someone typing just ">>> TO:" without a topic
            if (content.match(/>>> TO:/i)) {
                broker.internalPublish(`agent:${msg.sender}:inbox`, `[System Error]: Invalid syntax. Use ">>> TO: <topic_name> <message>"`, 'system');
            }
        }
    });
}
