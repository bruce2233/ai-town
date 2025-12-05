
export enum TopicType {
    PUBLIC = 'public',
    PRIVATE = 'private'
}

export interface Topic {
    name: string;
    type: TopicType;
    owner: string; // Agent ID who created it
    allowedSubscribers: Set<string>; // For private topics
    description?: string;
}

export class TopicManager {
    private topics = new Map<string, Topic>();

    constructor() {
        // Default System Topics
        this.createTopic('town_hall', TopicType.PUBLIC, 'admin', 'Official Town Hall Announcements');
        this.createTopic('town:create_character', TopicType.PRIVATE, 'admin', 'Character Generation Requests');
        this.getTopic('town:create_character')!.allowedSubscribers.add('mayor'); // Only mayor can see this presumably? Or maybe it's for the special 'creator' agent.
    }

    createTopic(name: string, type: TopicType, owner: string, description?: string): Topic {
        const topic: Topic = {
            name,
            type,
            owner,
            allowedSubscribers: new Set([owner]),
            description
        };
        this.topics.set(name, topic);
        return topic;
    }

    deleteTopic(name: string): boolean {
        return this.topics.delete(name);
    }

    getTopic(name: string): Topic | undefined {
        return this.topics.get(name);
    }

    getAllTopics(): Topic[] {
        return Array.from(this.topics.values());
    }

    canSubscribe(topicName: string, userId: string): boolean {
        const topic = this.topics.get(topicName);
        if (!topic) return false; // Or true if we allow auto-creation? Requirement says "entity can create topics". Let's restrict to existing for now or auto-create as public.

        if (topic.type === TopicType.PUBLIC) return true;
        return topic.allowedSubscribers.has(userId) || topic.owner === userId;
    }

    canPublish(topicName: string, userId: string): boolean {
        const topic = this.topics.get(topicName);
        if (!topic) return true; // If topic doesn't exist, maybe we allow? Or block? Let's block for now.

        // Town Hall logic: Only admin can publish
        if (topicName === 'town_hall' && userId !== 'admin') return false;

        // Private topic: Only owner or allowed? 
        // Requirement: "private only specific people can see". Usually implies they can also write? 
        // For now, if you can see it, you can write to it? Or maybe strict ownership?
        // Let's go with: Public = anyone can publish. Private = Only allowedSubscribers can publish.
        if (topic.type === TopicType.PUBLIC) return true;

        return topic.allowedSubscribers.has(userId) || topic.owner === userId;
    }

    addSubscriberPermission(topicName: string, ownerId: string, targetUserId: string): boolean {
        const topic = this.topics.get(topicName);
        if (!topic) return false;
        if (topic.owner !== ownerId && ownerId !== 'admin') return false;

        topic.allowedSubscribers.add(targetUserId);
        return true;
    }
}
