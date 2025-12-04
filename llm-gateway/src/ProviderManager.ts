import axios, { AxiosInstance } from 'axios';

export interface LLMProviderConfig {
    name: string;
    baseURL: string;
    apiKey: string;
    priority: number; // Lower number = higher priority
    timeout?: number;
}

export class ProviderManager {
    private providers: LLMProviderConfig[];
    private currentProviderIndex: number = 0;

    constructor(providers: LLMProviderConfig[]) {
        this.providers = providers.sort((a, b) => a.priority - b.priority);
    }

    get activeProvider(): LLMProviderConfig | undefined {
        return this.providers[this.currentProviderIndex];
    }

    getProviders(): LLMProviderConfig[] {
        return this.providers;
    }

    addProvider(provider: LLMProviderConfig): void {
        const existing = this.providers.find(p => p.name === provider.name);
        if (existing) {
            throw new Error(`Provider with name ${provider.name} already exists.`);
        }
        this.providers.push(provider);
        this.resortProviders();
    }

    removeProvider(name: string): void {
        this.providers = this.providers.filter(p => p.name !== name);
        this.resortProviders();
    }

    updateProvider(name: string, updates: Partial<LLMProviderConfig>): void {
        const provider = this.providers.find(p => p.name === name);
        if (!provider) {
            throw new Error(`Provider with name ${name} not found.`);
        }
        Object.assign(provider, updates);
        this.resortProviders();
    }

    private resortProviders() {
        this.providers.sort((a, b) => a.priority - b.priority);
        // Reset index if needed, though usually we want to start from 0 on next request anyway
        this.currentProviderIndex = 0;
    }

    async executeRequest(endpoint: string, method: string, data: any): Promise<any> {
        const errors: any[] = [];

        // Try providers in order of priority
        for (let i = 0; i < this.providers.length; i++) {
            const provider = this.providers[i];
            console.log(`[Gateway] Trying provider: ${provider.name} (${provider.baseURL})`);

            try {
                const response = await axios({
                    method,
                    url: `${provider.baseURL}${endpoint}`,
                    headers: {
                        'Authorization': `Bearer ${provider.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    data,
                    timeout: provider.timeout || 10000
                });

                console.log(`[Gateway] Success with provider: ${provider.name}`);
                this.currentProviderIndex = i; // Remember successful provider? Or always reset?
                // For failover, we usually want to stick to the highest priority that works,
                // so we don't update currentProviderIndex permanently unless we want "sticky" sessions.
                // But here we just return.
                return response.data;
            } catch (error: any) {
                console.error(`[Gateway] Failed with provider ${provider.name}:`, error.message);
                errors.push({ provider: provider.name, error: error.message });
                // Continue to next provider
            }
        }

        // If all failed
        throw new Error(`All providers failed. Errors: ${JSON.stringify(errors)}`);
    }
}
