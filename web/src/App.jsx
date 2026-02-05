import { createSignal } from 'solid-js';
import './index.css';
import Editor from './Editor';

function App() {
  const [query, setQuery] = createSignal('');
  const [artistQuery, setArtistQuery] = createSignal('');
  const [results, setResults] = createSignal([]);
  const [selectedRelease, setSelectedRelease] = createSignal(null);
  const [loading, setLoading] = createSignal(false);
  const [theme, setTheme] = createSignal('dark');

  const toggleTheme = () => {
    const newTheme = theme() === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const search = async (e) => {
    e.preventDefault();
    if (!query()) return;

    setLoading(true);
    try {
      let finalQuery = query();
      if (artistQuery()) {
        finalQuery = `release:${query()} AND artist:${artistQuery()}`;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(finalQuery)}`);
      const data = await res.json();
      setResults(data.releases || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectAlbum = async (release) => {
    // Set basic info first so UI updates immediately
    setSelectedRelease(release);
    try {
      const res = await fetch(`/api/release/${release.id}`);
      if (res.ok) {
        const fullRelease = await res.json();
        setSelectedRelease(fullRelease);
      }
    } catch (err) {
      console.error("Failed to fetch release details", err);
    }
  };

  return (
    <>
      <button
        class="theme-toggle"
        onClick={toggleTheme}
        title="Toggle Theme"
      >
        {theme() === 'dark' ? '☀️' : '🌙'}
      </button>
      <h1>MiniDisc Cover Creator</h1>

      <div class="layout">
        <aside class="glass-card sidebar">
          <h2>Search MusicBrainz</h2>
          <form onSubmit={search} style={{ display: 'flex', 'flex-direction': 'column', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Album..."
              value={query()}
              value={query()}
              onInput={(e) => setQuery(e.target.value)}
              style={{ width: '100%', 'box-sizing': 'border-box' }}
            />
            <input
              type="text"
              placeholder="Artist (Optional)..."
              value={artistQuery()}
              value={artistQuery()}
              onInput={(e) => setArtistQuery(e.target.value)}
              style={{ width: '100%', 'box-sizing': 'border-box' }}
            />
            <button type="submit" disabled={loading()} style={{ width: '100%' }}>
              {loading() ? '...' : 'Go'}
            </button>
          </form>

          <div class="results-list">
            {results().map((release) => (
              <div
                class="search-result"
                onClick={() => selectAlbum(release)}
                style={{ display: 'flex', 'align-items': 'center', gap: '1rem' }}
              >
                <img
                  src={`https://coverartarchive.org/release/${release.id}/front-250`}
                  alt=""
                  style={{ width: '40px', height: '40px', 'object-fit': 'cover', 'border-radius': '4px', background: '#333' }}
                  onError={(e) => e.target.style.opacity = 0}
                />
                <div>
                  <div><strong>{release.title}</strong></div>
                  <div style={{ color: 'var(--text-secondary)', 'font-size': '0.9em' }}>
                    {release['artist-credit']?.[0]?.name} ({release.date?.split('-')[0]})
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main class="glass-card editor-area">
          {selectedRelease() ? (
            <Editor release={selectedRelease()} />
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>Select an album to start designing</p>
          )}
        </main>
      </div>
    </>
  );
}

export default App;
