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
