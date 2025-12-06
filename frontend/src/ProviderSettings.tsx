import { useState, useEffect } from 'react';
import './ProviderSettings.css';

interface Provider {
    name: string;
    baseURL: string;
    priority: number;
    apiKey: string;
}

// Helper to determine gateway URL dynamically
const getGatewayUrl = () => {
    if (import.meta.env.VITE_GATEWAY_URL) return import.meta.env.VITE_GATEWAY_URL;
    // Fallback to current hostname (for LAN access) on port 8081
    return `${window.location.protocol}//${window.location.hostname}:8081`;
};

export function ProviderSettings() {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [newProvider, setNewProvider] = useState<Partial<Provider>>({ priority: 10 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const gatewayUrl = getGatewayUrl();
            const res = await fetch(`${gatewayUrl}/admin/providers`);
            const data = await res.json();
            setProviders(data);
        } catch (e) {
            console.error('Failed to fetch providers', e);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProvider.name || !newProvider.baseURL || !newProvider.apiKey) return;

        setLoading(true);
        try {
            const gatewayUrl = getGatewayUrl();
            await fetch(`${gatewayUrl}/admin/providers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProvider)
            });
            setNewProvider({ priority: 10, name: '', baseURL: '', apiKey: '' });
            fetchProviders();
        } catch (e) {
            console.error('Failed to add provider', e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (name: string) => {
        if (!confirm(`Delete provider ${name}?`)) return;
        try {
            const gatewayUrl = getGatewayUrl();
            await fetch(`${gatewayUrl}/admin/providers/${name}`, { method: 'DELETE' });
            fetchProviders();
        } catch (e) {
            console.error('Failed to delete provider', e);
        }
    };

    return (
        <div className="provider-settings">
            <h2>LLM Providers</h2>

            <GlobalModelConfig />

            <div className="provider-list">
                {providers.map(p => (
                    <div key={p.name} className="provider-card">
                        <div className="provider-info">
                            <h3>{p.name}</h3>
                            <div className="provider-meta">
                                <span className="tag">Priority: {p.priority}</span>
                                <span className="url" title={p.baseURL}>{p.baseURL}</span>
                            </div>
                            <ModelList providerName={p.name} />
                        </div>
                        <button onClick={() => handleDelete(p.name)} className="delete-btn">Delete</button>
                    </div>
                ))}
            </div>

            <form onSubmit={handleAdd} className="add-provider-form">
                <h3>Add New Provider</h3>
                <div className="form-group">
                    <input
                        placeholder="Name (e.g. OpenRouter)"
                        value={newProvider.name || ''}
                        onChange={e => setNewProvider({ ...newProvider, name: e.target.value })}
                    />
                    <input
                        placeholder="Base URL"
                        value={newProvider.baseURL || ''}
                        onChange={e => setNewProvider({ ...newProvider, baseURL: e.target.value })}
                    />
                    <input
                        placeholder="API Key"
                        type="password"
                        value={newProvider.apiKey || ''}
                        onChange={e => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                    />
                    <input
                        type="number"
                        placeholder="Priority"
                        value={newProvider.priority}
                        onChange={e => setNewProvider({ ...newProvider, priority: parseInt(e.target.value) })}
                    />
                </div>
                <button type="submit" disabled={loading}>
                    {loading ? 'Adding...' : 'Add Provider'}
                </button>
            </form>
        </div>
    );
}

function GlobalModelConfig() {
    const [currentModel, setCurrentModel] = useState<string | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const gatewayUrl = getGatewayUrl();
                const res = await fetch(`${gatewayUrl}/admin/config`);
                const data = await res.json();
                setCurrentModel(data.model);
            } catch (e) {
                console.error('Failed to fetch config', e);
            }
        };

        fetchConfig();
        // Poll every 5 seconds to keep sync if changed elsewhere
        const interval = setInterval(fetchConfig, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="global-config">
            <h3>Global Default Model</h3>
            <p>
                Currently active model: <strong>{currentModel || 'Not set (using agent defaults)'}</strong>
            </p>
            <p>
                This model will override all specific agent configurations. Select a model below to set it.
            </p>
        </div>
    );
}

interface Model {
    id: string;
    object?: string;
    created?: number;
    owned_by?: string;
    [key: string]: unknown;
}

function ModelList({ providerName }: { providerName: string }) {
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);

    const checkModels = async () => {
        if (visible && models.length > 0) {
            setVisible(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const gatewayUrl = getGatewayUrl();
            const res = await fetch(`${gatewayUrl}/admin/providers/${providerName}/models`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            // Standardize response: some providers return { data: [...] }, others might be [...]
            const list = Array.isArray(data) ? data : (data.data || []);
            setModels(list);
            setVisible(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="model-list-section">
            <button
                className="check-models-btn"
                onClick={checkModels}
                disabled={loading}
                type="button"
            >
                {loading ? 'Checking...' : (visible ? 'Hide Models' : 'Check Models')}
            </button>

            {error && <div className="error-msg">{error}</div>}

            {visible && models.length > 0 && (
                <div className="models-dropdown">
                    <h4>Available Models:</h4>
                    <ul>
                        {models.map((m: Model, i: number) => (
                            <li key={m.id || i}>
                                <span title={m.id}>{m.id || JSON.stringify(m)}</span>
                                <button
                                    onClick={async () => {
                                        if (!confirm(`Set global model to ${m.id}?`)) return;
                                        try {
                                            const gatewayUrl = getGatewayUrl();
                                            await fetch(`${gatewayUrl}/admin/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ model: m.id })
                                            });
                                            // Trigger reload effectively by waiting for poll or manual
                                            alert(`Global model set to ${m.id}`);
                                        } catch (e) {
                                            alert('Failed to set model');
                                            console.error(e);
                                        }
                                    }}
                                    className="select-model-btn"
                                >
                                    Select
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {visible && models.length === 0 && !error && (
                <div className="info-msg">No models found directly.</div>
            )}
        </div>
    );
}
