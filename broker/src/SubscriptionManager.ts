
import { WebSocket } from 'ws';

export interface Subscriber {
    id: string;
    ws: WebSocket;
}

export class SubscriptionManager {
    // Topic Name -> Set of Subscriber IDs
    private wildcardSubscribers = new Set<Subscriber>();
    private subscriptions = new Map<string, Set<Subscriber>>();
    private clientSubscriptions = new Map<string, Set<string>>();

    subscribe(topic: string, subscriber: Subscriber) {
        if (topic === '*') {
            this.wildcardSubscribers.add(subscriber);
        } else {
            if (!this.subscriptions.has(topic)) {
                this.subscriptions.set(topic, new Set());
            }
            this.subscriptions.get(topic)!.add(subscriber);
        }

        if (!this.clientSubscriptions.has(subscriber.id)) {
            this.clientSubscriptions.set(subscriber.id, new Set());
        }
        this.clientSubscriptions.get(subscriber.id)!.add(topic);
    }

    unsubscribe(topic: string, subscriberId: string) {
        if (topic === '*') {
            for (const sub of this.wildcardSubscribers) {
                if (sub.id === subscriberId) {
                    this.wildcardSubscribers.delete(sub);
                    break;
                }
            }
        } else {
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

    getWildcardSubscribers(): Subscriber[] {
        return Array.from(this.wildcardSubscribers);
    }

    getTopicsForSubscriber(subscriberId: string): string[] {
        const topics = this.clientSubscriptions.get(subscriberId);
        return topics ? Array.from(topics) : [];
    }
}
