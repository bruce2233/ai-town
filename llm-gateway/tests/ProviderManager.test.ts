import { ProviderManager, LLMProviderConfig } from '../src/ProviderManager';

describe('ProviderManager', () => {
    let manager: ProviderManager;

    const mockProvider1: LLMProviderConfig = {
        name: 'Provider1',
        baseURL: 'http://p1',
        apiKey: 'k1',
        priority: 10
    };

    const mockProvider2: LLMProviderConfig = {
        name: 'Provider2',
        baseURL: 'http://p2',
        apiKey: 'k2',
        priority: 5
    };

    beforeEach(() => {
        manager = new ProviderManager([mockProvider1]);
    });

    test('should initialize with providers sorted by priority', () => {
        manager = new ProviderManager([mockProvider1, mockProvider2]);
        const providers = manager.getProviders();
        expect(providers[0].name).toBe('Provider2'); // Priority 5
        expect(providers[1].name).toBe('Provider1'); // Priority 10
    });

    test('should add a new provider and resort', () => {
        manager.addProvider(mockProvider2);
        const providers = manager.getProviders();
        expect(providers.length).toBe(2);
        expect(providers[0].name).toBe('Provider2');
    });

    test('should throw error when adding duplicate provider name', () => {
        expect(() => manager.addProvider(mockProvider1)).toThrow();
    });

    test('should remove a provider', () => {
        manager.addProvider(mockProvider2);
        manager.removeProvider('Provider1');
        const providers = manager.getProviders();
        expect(providers.length).toBe(1);
        expect(providers[0].name).toBe('Provider2');
    });

    test('should update a provider and resort', () => {
        manager.addProvider(mockProvider2);
        // Provider2 (5) is first, Provider1 (10) is second

        // Update Provider1 to have priority 1 (highest)
        manager.updateProvider('Provider1', { priority: 1 });

        const providers = manager.getProviders();
        expect(providers[0].name).toBe('Provider1');
        expect(providers[1].name).toBe('Provider2');
    });
});
