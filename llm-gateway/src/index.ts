import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ProviderManager, LLMProviderConfig } from './ProviderManager';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8081;

// Configuration - In a real app, this would come from a config file or DB
const providers: LLMProviderConfig[] = [
    {
        name: 'Custom Provider',
        baseURL: process.env.LLM_PROVIDER_URL || 'http://host.docker.internal:8082/v1',
        apiKey: process.env.LLM_PROVIDER_KEY || 'dummy',
        priority: 1,
        timeout: 10000
    },
    {
        name: 'OpenAI Mock (Fallback)',
        baseURL: 'https://api.openai.com/v1', // Or OpenRouter
        apiKey: process.env.OPENAI_API_KEY || 'sk-dummy',
        priority: 2,
        timeout: 30000
    }
];

const providerManager = new ProviderManager(providers);

// OpenAI-compatible Chat Completions Endpoint
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const result = await providerManager.executeRequest('/chat/completions', 'POST', req.body);
        res.json(result);
    } catch (error: any) {
        res.status(502).json({
            error: {
                message: 'Bad Gateway: All LLM providers failed.',
                details: error.message
            }
        });
    }
});

// OpenAI-compatible Models Endpoint
app.get('/v1/models', async (req, res) => {
    try {
        // Just use the active or first provider for general "available models" discovery
        // This is a simplification; ideally we'd aggregation or use a specific "discovery" provider
        const result = await providerManager.executeRequest('/models', 'GET', null);
        res.json(result);
    } catch (error: any) {
        res.status(502).json({
            error: {
                message: 'Bad Gateway: Failed to fetch models.',
                details: error.message
            }
        });
    }
});

// Admin API for Provider Management
app.get('/admin/providers', (req, res) => {
    res.json(providerManager.getProviders());
});

app.post('/admin/providers', (req, res) => {
    try {
        const provider = req.body as LLMProviderConfig;
        if (!provider.name || !provider.baseURL || !provider.apiKey) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        providerManager.addProvider(provider);
        res.status(201).json(provider);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/admin/providers/:name', (req, res) => {
    try {
        const { name } = req.params;
        const updates = req.body as Partial<LLMProviderConfig>;
        providerManager.updateProvider(name, updates);
        res.json({ status: 'ok' });
    } catch (error: any) {
        res.status(404).json({ error: error.message });
    }
});

app.delete('/admin/providers/:name', (req, res) => {
    try {
        const { name } = req.params;
        providerManager.removeProvider(name);
        res.status(204).send();
    } catch (error: any) {
        res.status(404).json({ error: error.message });
    }
});

app.get('/admin/providers/:name/models', async (req, res) => {
    try {
        const { name } = req.params;
        const result = await providerManager.fetchModels(name);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', activeProvider: providerManager.activeProvider?.name || 'None' });
});

app.listen(PORT, () => {
    console.log(`LLM Gateway running on port ${PORT}`);
    console.log('Configured Providers:', providers.map(p => p.name).join(', '));
});
