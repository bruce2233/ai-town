
import { WebSocket } from 'ws';

export interface Subscriber {
    id: string;
    ws: WebSocket;
}

export class SubscriptionManager {
    // Topic Name -> Set of Subscriber IDs
    private subscriptions = new Map<string, Set<Subscriber>>();

    // Subscriber ID -> Set of Topic Names (for reverse lookup/cleanup)
    private clientSubscriptions = new Map<string, Set<string>>();

    subscribe(topic: string, subscriber: Subscriber) {
        if (!this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, new Set());
        }
        this.subscriptions.get(topic)!.add(subscriber);

        if (!this.clientSubscriptions.has(subscriber.id)) {
            this.clientSubscriptions.set(subscriber.id, new Set());
        }
        this.clientSubscriptions.get(subscriber.id)!.add(topic);
    }

    unsubscribe(topic: string, subscriberId: string) {
        // This is inefficient if we only have ID. 
        // Realistically we need the Subscriber object reference or we search.
        // For now let's iterate.
        const subs = this.subscriptions.get(topic);
        if (subs) {
            for (const sub of subs) {
                if (sub.id === subscriberId) {
                    subs.delete(sub);
                    break;
                }
            }
            if (subs.size === 0) {
                this.subscriptions.delete(topic);
            }
        }

        const clientSubs = this.clientSubscriptions.get(subscriberId);
        if (clientSubs) {
            clientSubs.delete(topic);
        }
    }

    unsubscribeAll(subscriberId: string) {
        const topics = this.clientSubscriptions.get(subscriberId);
        if (topics) {
            for (const topic of topics) {
                this.unsubscribe(topic, subscriberId);
            }
            this.clientSubscriptions.delete(subscriberId);
        }
    }

    updateSubscriberId(oldId: string, newId: string) {
        const topics = this.clientSubscriptions.get(oldId);
        if (topics) {
            this.clientSubscriptions.set(newId, topics);
            this.clientSubscriptions.delete(oldId);
        }
    }

    getSubscribers(topic: string): Subscriber[] {
        const subs = this.subscriptions.get(topic);
        return subs ? Array.from(subs) : [];
    }

    getTopicsForSubscriber(subscriberId: string): string[] {
        const topics = this.clientSubscriptions.get(subscriberId);
        return topics ? Array.from(topics) : [];
    }
}
