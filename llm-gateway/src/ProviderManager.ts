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

    get activeProvider(): LLMProviderConfig {
        return this.providers[this.currentProviderIndex];
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
