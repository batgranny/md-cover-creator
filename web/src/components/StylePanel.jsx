import { createSignal } from 'solid-js';
import { CustomNumberInput } from './CustomNumberInput';

export function StylePanel(props) {
    return (
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1rem' }}>
            {/* Image Upload */}
            <div class="glass-card" style={{ padding: '1rem' }}>
                <label style={{ display: 'block', 'font-size': '0.8em', 'margin-bottom': '0.5rem', color: 'var(--text-secondary)' }}>Cover Image</label>
                <input
                    type="file"
                    accept="image/*"
                    onChange={props.handleImageUpload}
                    style={{ width: '100%', 'max-width': '100%', 'box-sizing': 'border-box', 'font-size': '0.9em' }}
                />
                <div style={{ 'margin-top': '0.5rem', 'font-size': '0.75em', color: 'var(--text-secondary)' }}>
                    <small>Click image to resize/crop.</small>
                </div>
            </div>

            {/* Style Bar */}
            <div class="glass-card" style={{ padding: '1rem', display: 'flex', 'flex-direction': 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', 'align-items': 'center', 'justify-content': 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', 'align-items': 'center' }} title="Background Color">
                        <span style={{ 'font-size': '0.9em', 'font-weight': 'bold', color: 'var(--text-secondary)' }}>BG</span>
                        <input
                            type="color"
                            value={props.backgroundColor}
                            onInput={(e) => props.setBackgroundColor(e.target.value)}
                            style={{ width: '30px', height: '30px', padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', 'align-items': 'center' }} title="Text Color">
                        <span style={{ 'font-size': '0.9em', 'font-weight': 'bold', color: 'var(--text-secondary)' }}>Text</span>
                        <input
                            type="color"
                            value={props.textColor}
                            onInput={(e) => props.setTextColor(e.target.value)}
                            style={{ width: '30px', height: '30px', padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}
                        />
                    </div>
                </div>
                <div style={{ height: '1px', background: 'var(--glass-border)' }}></div>
                <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '0.5rem' }}>
                    <label style={{ 'font-size': '0.8em', display: 'flex', 'align-items': 'center', gap: '0.5rem' }} title="Tracklist Font Size">
                        <span>🔢</span>
                        <CustomNumberInput step="0.1" value={props.tracklistFontSize} onInput={props.setTracklistFontSize} style={{ width: '100%' }} />
                    </label>
                    <label style={{ 'font-size': '0.8em', display: 'flex', 'align-items': 'center', gap: '0.5rem' }} title="Tracklist Line Spacing">
                        <span>↕️</span>
                        <CustomNumberInput step="0.1" value={props.tracklistLinePadding} onInput={props.setTracklistLinePadding} style={{ width: '100%' }} />
                    </label>
                    <label style={{ 'font-size': '0.8em', display: 'flex', 'align-items': 'center', gap: '0.5rem' }} title="Spine Font Size">
                        <span>📖</span>
                        <CustomNumberInput step="0.5" placeholder="Auto" value={props.spineFontSize} onInput={props.setSpineFontSize} style={{ width: '100%' }} />
                    </label>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', 'margin-top': 'auto' }}>
                <button
                    onClick={props.exportPDF}
                    style={{ flex: 1, padding: '0.75rem', 'background-color': 'var(--accent-color)', color: 'white', border: 'none', 'border-radius': '0.5rem', cursor: 'pointer', 'font-weight': 'bold', transition: 'background-color 0.2s' }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#1976D2'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'var(--accent-color)'}
                >
                    Download PDF
                </button>
                <button
                    onClick={props.clearLocalStorage}
                    style={{ padding: '0.75rem', 'background-color': '#e53935', color: 'white', border: 'none', 'border-radius': '0.5rem', cursor: 'pointer', 'font-weight': 'bold', transition: 'background-color 0.2s' }}
                    title="Reset All"
                    onMouseOver={(e) => e.target.style.backgroundColor = '#c62828'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#e53935'}
                >
                    Reset
                </button>
            </div>
        </div>
    );
}
