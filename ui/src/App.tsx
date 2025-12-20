import { useEffect, useState, useRef } from 'react';
import './index.css';
import type { GlobalState } from './types';

// Simple Effect-like fetcher (simulated for UI simplicity, keeping overhead low)
const fetchState = async (): Promise<GlobalState | null> => {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
};

function App() {
  const [state, setState] = useState<GlobalState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const newState = await fetchState();
      if (newState) {
        setState(newState);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state?.history.length]);

  if (!state) {
    return (
      <div className="glass-panel" style={{ margin: '20vh auto', textAlign: 'center', maxWidth: '400px' }}>
        <h2>Connecting to AI Town...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Ensure the background simulation is running.</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>AI Town Simulation</h1>
        <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Tick: {state.tick} • Agents: {Object.keys(state.agents).length}
        </div>
      </header>

      <div className="grid-layout">
        {/* Left Col: Narrative History */}
        <section className="glass-panel">
          <h2 style={{ marginTop: 0 }}>Storyline</h2>
          <div className="story-feed" ref={scrollRef}>
            {state.history.length === 0 ? (
              <div style={{ padding: '1rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                The story is about to begin...
              </div>
            ) : (
              state.history.map((entry, idx) => (
                <div key={idx} className="story-item">
                  {entry}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Col: Agent Status */}
        <section className="glass-panel">
          <h2 style={{ marginTop: 0 }}>Residents</h2>
          <div className="agent-list">
            {Object.values(state.agents).map((agent) => (
              <div key={agent.id} className="glass-panel agent-card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)' }}>
                <div className="agent-name">{agent.name}</div>
                <div className="agent-status">{agent.status}</div>
                <div className="agent-desc">{agent.description}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
