
import WebSocket from 'ws';

const BROKER_URL = 'ws://localhost:8080';

// Helper to wait for meaningful messages
function waitForMessage(ws: WebSocket, type: string): Promise<any> {
    return new Promise((resolve) => {
        const handler = (data: any) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === type) {
                ws.off('message', handler);
                resolve(msg);
            }
        };
        ws.on('message', handler);
    });
}

function waitForStatus(ws: WebSocket, status: string): Promise<any> {
    return new Promise((resolve) => {
        const handler = (data: any) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'system' && msg.payload.status === status) {
                ws.off('message', handler);
                resolve(msg);
            }
        };
        ws.on('message', handler);
    });
}

async function test() {
    console.log('Starting Broker Test...');

    const admin = new WebSocket(BROKER_URL);
    const user1 = new WebSocket(BROKER_URL);
    const user2 = new WebSocket(BROKER_URL);

    await new Promise(r => setTimeout(r, 1000)); // Wait for connection

    // 0. Identify
    console.log('0. Identifying clients...');
    admin.send(JSON.stringify({ type: 'identify', payload: { id: 'admin', key: 'admin_secret' } }));
    // Wait for the 'identified' message which confirms the ID switch
    await waitForStatus(admin, 'identified');

    user1.send(JSON.stringify({ type: 'identify', payload: { id: 'User1' } }));
    await waitForStatus(user1, 'identified');

    user2.send(JSON.stringify({ type: 'identify', payload: { id: 'User2' } }));
    await waitForStatus(user2, 'identified');
    console.log('Identified: admin, User1, User2');

    // 1. Test Subscription
    console.log('1. Testing Subscription...');
    user1.send(JSON.stringify({ type: 'subscribe', topic: 'town_hall' })); // Already auto-subscribed but ok
    await waitForStatus(user1, 'subscribed');

    // 2. Test Town Hall Publish (Admin only)
    console.log('2. Testing Town Hall Publish...');

    // User1 tries to publish to town_hall -> Should fail
    user1.send(JSON.stringify({
        type: 'publish',
        topic: 'town_hall',
        payload: { content: 'Hack the planet' }
    }));
    const errorMsg = await waitForMessage(user1, 'error');
    if (errorMsg.payload.message.includes('Permission denied')) {
        console.log('PASS: User1 blocked from publishing to town_hall');
    } else {
        console.error('FAIL: User1 was NOT blocked');
    }

    // Admin publishes
    admin.send(JSON.stringify({
        type: 'publish',
        topic: 'town_hall',
        payload: { content: 'Official Announcement' }
    }));

    // User1 should receive it
    const announcement = await waitForMessage(user1, 'message');
    if (announcement.topic === 'town_hall' && announcement.payload.content === 'Official Announcement') {
        console.log('PASS: Admin published to town_hall');
    } else {
        console.error('FAIL: User1 did not receive announcement correctly');
    }

    // 3. Test Implicit Public Topic
    console.log('3. Testing Public Topic...');
    const publicTopic = 'general_chat';
    user2.send(JSON.stringify({ type: 'subscribe', topic: publicTopic }));
    await waitForStatus(user2, 'subscribed');

    user1.send(JSON.stringify({
        type: 'publish',
        topic: publicTopic,
        payload: { content: 'Hello User2' }
    }));

    const chatMsg = await waitForMessage(user2, 'message');
    if (chatMsg.payload.content === 'Hello User2') {
        console.log('PASS: Public Pub/Sub works');
    } else {
        console.error('FAIL: Payload mismatch');
    }

    // 4. Test Private Topic (Inbox)
    console.log('4. Testing Private Inbox...');
    // User2 tries to subscribe to User1's inbox
    const targetTopic = 'agent:User1:inbox';
    user2.send(JSON.stringify({ type: 'subscribe', topic: targetTopic }));

    // Expect error
    const deniedMsg = await waitForMessage(user2, 'error');
    if (deniedMsg.payload.message.includes('Permission denied')) {
        console.log('PASS: User2 blocked from User1 inbox');
    } else {
        console.error('FAIL: User2 allowed to subscribe to private inbox');
    }

    // User1 subscribes to their own inbox
    user1.send(JSON.stringify({ type: 'subscribe', topic: targetTopic }));
    await waitForStatus(user1, 'subscribed');
    console.log('PASS: User1 subscribed to own inbox');

    // User2 sends message to User1 inbox
    user2.send(JSON.stringify({
        type: 'publish',
        topic: targetTopic,
        payload: { content: 'Private message' }
    }));

    const privateMsg = await waitForMessage(user1, 'message');
    if (privateMsg.payload.content === 'Private message') {
        console.log('PASS: User1 received private message');
    } else {
        console.error('FAIL: User1 did not receive private message');
    }

    admin.close();
    user1.close();
    user2.close();
    console.log('DONE');
    process.exit(0);
}

test().catch(console.error);
