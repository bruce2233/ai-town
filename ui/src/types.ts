export type AgentId = string & { __brand: "AgentId" };
export type LocationId = string & { __brand: "LocationId" };

export interface GlobalState {
    readonly tick: number;
    readonly agents: Record<AgentId, {
        readonly id: AgentId;
        readonly name: string;
        readonly description: string;
        readonly locationId: LocationId;
        readonly status: string;
        readonly memory: Record<string, any>;
    }>;
    readonly locations: Record<LocationId, {
        readonly id: LocationId;
        readonly name: string;
        readonly description: string;
    }>;
    readonly history: readonly string[];
}
