import { useState, useEffect } from 'react';

interface Provider {
    name: string;
    baseURL: string;
    priority: number;
    apiKey: string;
}

export function ProviderSettings() {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [newProvider, setNewProvider] = useState<Partial<Provider>>({ priority: 10 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchProviders();
    }, []);

    const fetchProviders = async () => {
        try {
            const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8081';
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
            const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8081';
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
            const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8081';
            await fetch(`${gatewayUrl}/admin/providers/${name}`, { method: 'DELETE' });
            fetchProviders();
        } catch (e) {
            console.error('Failed to delete provider', e);
        }
    };

    return (
        <div className="provider-settings">
            <h2>LLM Providers</h2>

            <div className="provider-list">
                {providers.map(p => (
                    <div key={p.name} className="provider-card">
                        <div className="provider-info">
                            <h3>{p.name}</h3>
                            <div className="provider-meta">
                                <span className="tag">Priority: {p.priority}</span>
                                <span className="url">{p.baseURL}</span>
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
            const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8081';
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
        <div className="model-list-section" style={{ marginTop: '10px' }}>
            <button
                className="check-models-btn"
                onClick={checkModels}
                disabled={loading}
                type="button"
                style={{
                    padding: '4px 8px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    backgroundColor: '#e0e0e0',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                }}
            >
                {loading ? 'Checking...' : (visible ? 'Hide Models' : 'Check Models')}
            </button>

            {error && <div className="error-msg" style={{ color: 'red', fontSize: '0.8rem', marginTop: '4px' }}>{error}</div>}

            {visible && models.length > 0 && (
                <div className="models-dropdown" style={{
                    marginTop: '8px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    background: '#f9f9f9',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #eee'
                }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>Available Models:</h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {models.map((m: Model, i: number) => (
                            <li key={m.id || i} style={{ fontSize: '0.8rem', padding: '2px 0', borderBottom: '1px solid #eee' }}>
                                {m.id || JSON.stringify(m)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {visible && models.length === 0 && !error && (
                <div className="info-msg" style={{ fontSize: '0.8rem', marginTop: '4px', fontStyle: 'italic' }}>No models found directly.</div>
            )}
        </div>
    );
}
