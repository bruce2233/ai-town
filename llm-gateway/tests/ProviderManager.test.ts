import axios from 'axios';
import { ProviderManager, LLMProviderConfig } from '../src/ProviderManager';

jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

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
        jest.clearAllMocks();
    });

    // ... existing tests ...

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
        manager.updateProvider('Provider1', { priority: 1 });
        const providers = manager.getProviders();
        expect(providers[0].name).toBe('Provider1');
        expect(providers[1].name).toBe('Provider2');
    });

    test('fetchModels should call correct endpoint', async () => {
        mockedAxios.mockResolvedValue({ data: { data: [{ id: 'model1' }] } });
        const models = await manager.fetchModels('Provider1');
        expect(models).toEqual({ data: [{ id: 'model1' }] });
        expect(mockedAxios).toHaveBeenCalledWith({
            method: 'GET',
            url: 'http://p1/models',
            headers: {
                'Authorization': 'Bearer k1',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
    });

    test('fetchModels should throw if provider not found', async () => {
        await expect(manager.fetchModels('NonExistent')).rejects.toThrow('Provider with name NonExistent not found');
    });
});
