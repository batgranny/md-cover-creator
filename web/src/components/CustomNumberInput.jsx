import { createSignal } from 'solid-js';

export function CustomNumberInput(props) {
    const step = () => Number(props.step) || 1;

    const handleIncrement = (e) => {
        e.preventDefault();
        const current = Number(props.value) || 0;
        let newVal = current + step();
        newVal = Math.round(newVal * 100) / 100;
        props.onInput(newVal);
    };

    const handleDecrement = (e) => {
        e.preventDefault();
        const current = Number(props.value) || 0;
        let newVal = current - step();
        newVal = Math.round(newVal * 100) / 100;
        if (props.min !== undefined && newVal < props.min) newVal = props.min;
        props.onInput(newVal);
    };

    const handleInput = (e) => {
        if (e.target.value === '') {
            props.onInput(0);
        } else {
            props.onInput(Number(e.target.value));
        }
    };

    return (
        <div style={{
            display: 'flex',
            'align-items': 'stretch',
            background: 'var(--input-bg)',
            border: '1px solid var(--glass-border)',
            'border-radius': '4px',
            overflow: 'hidden',
            ...(props.style || {})
        }}>
            <input
                type="number"
                value={props.value === 0 && props.placeholder ? '' : props.value}
                onInput={handleInput}
                placeholder={props.placeholder}
                style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    padding: '0.6em 0.8em',
                    color: 'var(--text-primary)',
                    width: '100%',
                    'min-width': 0
                }}
            />
            <div style={{
                display: 'flex',
                'flex-direction': 'column',
                'background-color': 'rgba(128,128,128,0.1)',
                'border-left': '1px solid var(--glass-border)',
                width: '24px'
            }}>
                <button
                    onClick={handleIncrement}
                    style={{
                        flex: 1,
                        padding: 0,
                        background: 'transparent',
                        border: 'none',
                        'border-bottom': '1px solid var(--glass-border)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        'font-size': '0.7em',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'border-radius': 0
                    }}
                >
                    ▲
                </button>
                <button
                    onClick={handleDecrement}
                    style={{
                        flex: 1,
                        padding: 0,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        'font-size': '0.7em',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'border-radius': 0
                    }}
                >
                    ▼
                </button>
            </div>
        </div>
    );
}
