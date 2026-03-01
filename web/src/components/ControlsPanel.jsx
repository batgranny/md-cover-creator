import { createSignal } from 'solid-js';

export function ControlsPanel(props) {
    return (
        <div class="glass-card" style={{ padding: '1rem', display: 'flex', 'flex-direction': 'column', gap: '1rem', height: '100%', 'box-sizing': 'border-box' }}>
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '1rem' }}>
                <div>
                    <label style={{ display: 'block', 'font-size': '0.8em', 'margin-bottom': '0.2rem', color: 'var(--text-secondary)' }}>Artist</label>
                    <input
                        type="text"
                        placeholder="Artist Name..."
                        value={props.manualArtist}
                        onInput={(e) => props.setManualArtist(e.target.value)}
                        style={{ width: '100%', 'box-sizing': 'border-box' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', 'font-size': '0.8em', 'margin-bottom': '0.2rem', color: 'var(--text-secondary)' }}>Title</label>
                    <input
                        type="text"
                        placeholder="Album Title..."
                        value={props.manualTitle}
                        onInput={(e) => props.setManualTitle(e.target.value)}
                        style={{ width: '100%', 'box-sizing': 'border-box' }}
                    />
                </div>
            </div>

            <div style={{ display: 'flex', 'flex-direction': 'column', flex: 1 }}>
                <label style={{ display: 'block', 'font-size': '0.8em', 'margin-bottom': '0.2rem', color: 'var(--text-secondary)' }}>Tracklist</label>
                <textarea
                    value={props.tracklistText}
                    onInput={(e) => props.setTracklistText(e.target.value)}
                    placeholder="1. Track One... (one per line)"
                    style={{ width: '100%', 'box-sizing': 'border-box', 'font-family': 'monospace', padding: '0.5rem', resize: 'none', flex: 1 }}
                ></textarea>
            </div>
        </div>
    );
}
