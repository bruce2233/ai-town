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
        name: 'Local Qwen',
        baseURL: 'http://192.168.31.21:8082/v1',
        apiKey: 'dummy',
        priority: 1,
        timeout: 5000 // Fast timeout for local
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

app.get('/health', (req, res) => {
    res.json({ status: 'ok', activeProvider: providerManager.activeProvider.name });
});

app.listen(PORT, () => {
    console.log(`LLM Gateway running on port ${PORT}`);
    console.log('Configured Providers:', providers.map(p => p.name).join(', '));
});
