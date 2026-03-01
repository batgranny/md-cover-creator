import { createSignal, createEffect, onMount } from 'solid-js';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { renderCover, getTotalWidth, getTotalHeight, getImgGeo } from './utils/canvasRender';
import { ControlsPanel } from './components/ControlsPanel';
import { StylePanel } from './components/StylePanel';
import { CustomNumberInput } from './components/CustomNumberInput';

// J-card dimensions from user template (mm)
const DEFAULTS = {
    frontWidth: 68,
    frontHeight: 73,
    spineWidth: 5.5,
    spineHeight: 73,
    backWidth: 11, // Rear tab
    backHeight: 73,
    insideWidth: 66, // +1 fold-out panel
    bleed: 3
};

// Local Storage Keys
const STORAGE_KEYS = {
    MANUAL_ARTIST: 'md-cover-manual-artist',
    MANUAL_TITLE: 'md-cover-manual-title',
    IMAGE_STATE: 'md-cover-image-state',
    DIMENSIONS: 'md-cover-dimensions',
    BG_COLOR: 'md-cover-bg-color',
    TEXT_COLOR: 'md-cover-text-color',
    UPLOADED_IMAGE: 'md-cover-uploaded-image',
    TRACKLIST_FONT_SIZE: 'md-cover-tracklist-font-size',
    TRACKLIST_LINE_PADDING: 'md-cover-tracklist-line-padding',
    SPINE_FONT_SIZE: 'md-cover-spine-font-size',
    TRACKLIST_TEXT: 'md-cover-tracklist-text'
};

function Editor(props) {
    const [dimensions, setDimensions] = createSignal({ ...DEFAULTS });
    const [zoom, setZoom] = createSignal(1.2);

    // Image State: x, y (mm), scale
    const [imgState, setImgState] = createSignal({ x: 0, y: 0, scale: 1.0 });

    // Manual Input State
    const [manualArtist, setManualArtist] = createSignal('');
    const [manualTitle, setManualTitle] = createSignal('');

    // Color State
    const [backgroundColor, setBackgroundColor] = createSignal('#ffffff');
    const [textColor, setTextColor] = createSignal('#000000');
    // Tracklist Font Size State
    const [tracklistFontSize, setTracklistFontSize] = createSignal(3.2);
    const [tracklistLinePadding, setTracklistLinePadding] = createSignal(1.4);
    const [spineFontSize, setSpineFontSize] = createSignal(0); // 0 = Auto
    const [tracklistText, setTracklistText] = createSignal('');

    // Image Selection State
    const [imageSelected, setImageSelected] = createSignal(false);

    // UI State
    const [dimensionsExpanded, setDimensionsExpanded] = createSignal(false);

    let canvasRef;
    let imgObj = null;

    // Flag to prevent race conditions during reset
    let isResetting = false;

    // Interaction State
    let isDragging = false;
    let activeHandle = null;
    let startDragMs = { x: 0, y: 0 };
    let startImgState = { x: 0, y: 0, scale: 1.0 };

    // Helper functions to get artist/title with manual override
    const getArtistName = () => {
        // Prioritize manual input, then release prop, then fallback
        if (manualArtist()) return manualArtist();
        if (props.release?.['artist-credit']?.[0]?.name) return props.release['artist-credit'][0].name;
        return 'Artist Name';
    };

    const getAlbumTitle = () => {
        if (manualTitle()) return manualTitle();
        if (props.release?.title) return props.release.title;
        return 'Album Title';
    };

    // Clear local storage and reset to defaults
    const clearLocalStorage = () => {
        if (window.confirm('Clear all saved progress? This will reload the page.')) {
            isResetting = true; // Stop effects from saving
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            // Force reload to ensure a completely clean state without lingering effects
            window.location.reload();
        }
    };

    // Image upload handler
    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                imgObj = img;
                setImageSelected(true);
                setImgState({ x: 0, y: 0, scale: 1.0 });

                // Save to localStorage
                if (!isResetting) localStorage.setItem(STORAGE_KEYS.UPLOADED_IMAGE, event.target.result);

                draw();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    // Initialize tracklistText from props when release changes
    createEffect(() => {
        const r = props.release;
        if (r && r.media && r.media[0] && r.media[0].tracks) {
            const text = r.media[0].tracks.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
            setTracklistText(text);
        } else if (r?.id === 'manual' && tracklistText() === '') {
            // If it's a "Start from Scratch" release and tracklist is empty, clear it.
            setTracklistText('');
        }
    });

    // Load image when release changes
    createEffect(() => {
        if (props.release) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = `https://coverartarchive.org/release/${props.release.id}/front`;
            img.onload = () => {
                imgObj = img;
                setImageSelected(false);
                setImgState({ x: 0, y: 0, scale: 1.0 });
                draw();
            };
            img.onerror = () => {
                console.error("Failed to load cover art");
                imgObj = null;
                draw();
            };
        }
    });

    // Load from localStorage on mount
    onMount(() => {
        try {
            const savedArtist = localStorage.getItem(STORAGE_KEYS.MANUAL_ARTIST);
            const savedTitle = localStorage.getItem(STORAGE_KEYS.MANUAL_TITLE);
            const savedDimensions = localStorage.getItem(STORAGE_KEYS.DIMENSIONS);
            const savedBgColor = localStorage.getItem(STORAGE_KEYS.BG_COLOR);
            const savedTextColor = localStorage.getItem(STORAGE_KEYS.TEXT_COLOR);
            const savedImageState = localStorage.getItem(STORAGE_KEYS.IMAGE_STATE);
            const savedFontSize = localStorage.getItem(STORAGE_KEYS.TRACKLIST_FONT_SIZE);
            const savedLinePadding = localStorage.getItem(STORAGE_KEYS.TRACKLIST_LINE_PADDING);
            const savedSpineFontSize = localStorage.getItem(STORAGE_KEYS.SPINE_FONT_SIZE);
            const savedTracklistText = localStorage.getItem(STORAGE_KEYS.TRACKLIST_TEXT);
            const savedImage = localStorage.getItem(STORAGE_KEYS.UPLOADED_IMAGE);

            if (savedArtist) setManualArtist(savedArtist);
            if (savedTitle) setManualTitle(savedTitle);
            if (savedDimensions) setDimensions(JSON.parse(savedDimensions));
            if (savedBgColor) setBackgroundColor(savedBgColor);
            if (savedTextColor) setTextColor(savedTextColor);
            if (savedFontSize) setTracklistFontSize(parseFloat(savedFontSize));
            if (savedLinePadding) setTracklistLinePadding(parseFloat(savedLinePadding));
            if (savedSpineFontSize) setSpineFontSize(parseFloat(savedSpineFontSize));
            // Only restore text if we are in "manual" mode (Start from Scratch) to avoid overriding a fresh MB search?
            // actually if we have a saved text we probably want it?
            if (savedTracklistText) setTracklistText(savedTracklistText);
            if (savedImageState) setImgState(JSON.parse(savedImageState));

            // Load uploaded image from base64
            if (savedImage) {
                const img = new Image();
                img.onload = () => {
                    imgObj = img;
                    draw();
                };
                img.src = savedImage;
            }
        } catch (err) {
            console.error('Error loading from localStorage:', err);
        }
    });

    // Auto-save to localStorage on changes
    createEffect(() => {
        if (!isResetting) localStorage.setItem(STORAGE_KEYS.MANUAL_ARTIST, manualArtist());
    });

    createEffect(() => {
        if (!isResetting) localStorage.setItem(STORAGE_KEYS.MANUAL_TITLE, manualTitle());
    });

    createEffect(() => {
        if (!isResetting) localStorage.setItem(STORAGE_KEYS.DIMENSIONS, JSON.stringify(dimensions()));
    });

    createEffect(() => {
        if (!isResetting) localStorage.setItem(STORAGE_KEYS.BG_COLOR, backgroundColor());
    });

    createEffect(() => {
        if (!isResetting) localStorage.setItem(STORAGE_KEYS.TEXT_COLOR, textColor());
    });

    createEffect(() => {
        if (!isResetting) localStorage.setItem(STORAGE_KEYS.TRACKLIST_FONT_SIZE, tracklistFontSize());
    });

    createEffect(() => {
        if (!isResetting) localStorage.setItem(STORAGE_KEYS.TRACKLIST_LINE_PADDING, tracklistLinePadding());
    });

    createEffect(() => {
        if (!isResetting) localStorage.setItem(STORAGE_KEYS.SPINE_FONT_SIZE, spineFontSize());
    });

    createEffect(() => {
        if (!isResetting) localStorage.setItem(STORAGE_KEYS.TRACKLIST_TEXT, tracklistText());
    });

    createEffect(() => {
        if (!isResetting) localStorage.setItem(STORAGE_KEYS.IMAGE_STATE, JSON.stringify(imgState()));
    });

    createEffect(() => {
        dimensions();
        zoom();
        imgState();
        tracklistFontSize();
        tracklistLinePadding();
        spineFontSize();
        manualArtist();
        manualTitle();
        tracklistText();
        backgroundColor();
        textColor();
        draw();
    });

    // Note: Geometry functions have been moved to canvasRender.js

    const screenToMm = (sx, sy) => {
        if (!canvasRef) return { x: 0, y: 0 };
        const rect = canvasRef.getBoundingClientRect();
        const scaleX = canvasRef.width / rect.width;
        const scaleY = canvasRef.height / rect.height;

        const pxX = (sx - rect.left) * scaleX;
        const pxY = (sy - rect.top) * scaleY;

        const scalePxPerMm = zoom() * 3.7795;
        const originX = (dimensions().bleed + dimensions().backWidth + dimensions().spineWidth) * scalePxPerMm;
        const originY = dimensions().bleed * scalePxPerMm;
        const mmX = (pxX - originX) / scalePxPerMm;
        const mmY = (pxY - originY) / scalePxPerMm;
        return { x: mmX, y: mmY };
    };

    const handleMouseDown = (e) => {
        const mmPos = screenToMm(e.clientX, e.clientY);
        const geo = getImgGeo(imgObj, imgState(), dimensions());
        if (!geo) return;

        // Reset activeHandle on every new click
        activeHandle = null;

        // Increased tolerance to make corner boxes more easily selectable
        const tol = 4 / zoom();

        console.log(`Mouse Down! mmPos: x=${mmPos.x.toFixed(2)}, y=${mmPos.y.toFixed(2)}`);
        console.log(`Image Geo! geo.x=${geo.x.toFixed(2)}, geo.y=${geo.y.toFixed(2)}, w=${geo.w.toFixed(2)}, h=${geo.h.toFixed(2)}`);
        console.log(`Zoom: ${zoom().toFixed(2)}, Tol: ${tol.toFixed(2)}`);

        // Check if clicking on resize handles (only if image is selected)
        if (imageSelected()) {
            if (Math.abs(mmPos.x - geo.x) < tol && Math.abs(mmPos.y - geo.y) < tol) activeHandle = 'tl';
            else if (Math.abs(mmPos.x - (geo.x + geo.w)) < tol && Math.abs(mmPos.y - geo.y) < tol) activeHandle = 'tr';
            else if (Math.abs(mmPos.x - geo.x) < tol && Math.abs(mmPos.y - (geo.y + geo.h)) < tol) activeHandle = 'bl';
            else if (Math.abs(mmPos.x - (geo.x + geo.w)) < tol && Math.abs(mmPos.y - (geo.y + geo.h)) < tol) activeHandle = 'br';
        }

        // Check if clicking on image body
        let clickedInsideBody = (mmPos.x > geo.x && mmPos.x < geo.x + geo.w && mmPos.y > geo.y && mmPos.y < geo.y + geo.h);

        if (activeHandle) {
            // We clicked a resize handle. Keep image selected.
            setImageSelected(true);
        } else if (clickedInsideBody) {
            // We clicked the image body. Set handle to move.
            activeHandle = 'move';
            setImageSelected(true);
        } else {
            // Clicked outside image and outside handles
            setImageSelected(false);
            return;
        }

        if (activeHandle) {
            isDragging = true;
            startDragMs = { x: e.clientX, y: e.clientY };
            startImgState = { ...imgState() };
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const dxPx = e.clientX - startDragMs.x;
        const dyPx = e.clientY - startDragMs.y;
        const pxToMm = 1 / (zoom() * 3.7795);
        const dx = dxPx * pxToMm;
        const dy = dyPx * pxToMm;
        const aspect = imgObj ? imgObj.height / imgObj.width : 1;
        const baseW = dimensions().frontWidth * startImgState.scale;

        if (activeHandle === 'move') {
            setImgState({ ...imgState(), x: startImgState.x + dx, y: startImgState.y + dy });
        } else if (activeHandle === 'br') {
            const newW = Math.max(5, baseW + dx);
            setImgState({ ...imgState(), scale: newW / dimensions().frontWidth });
        } else if (activeHandle === 'bl') {
            const newW = Math.max(5, baseW - dx);
            setImgState({ ...imgState(), scale: newW / dimensions().frontWidth, x: startImgState.x + dx });
        } else if (activeHandle === 'tr') {
            const newW = Math.max(5, baseW + dx);
            const newScale = newW / dimensions().frontWidth;
            const oldH = baseW * aspect;
            const newH = newW * aspect;
            setImgState({ ...imgState(), scale: newScale, y: startImgState.y - (newH - oldH) });
        } else if (activeHandle === 'tl') {
            const newW = Math.max(5, baseW - dx);
            const newScale = newW / dimensions().frontWidth;
            const oldH = baseW * aspect;
            const newH = newW * aspect;
            setImgState({ ...imgState(), scale: newScale, x: startImgState.x + dx, y: startImgState.y - (newH - oldH) });
        }
    };

    const handleMouseUp = () => { isDragging = false; activeHandle = null; };

    const draw = () => {
        if (!canvasRef) return;
        const ctx = canvasRef.getContext('2d');
        const scale = zoom() * 3.7795;
        const totalW = getTotalWidth(dimensions());
        const totalH = getTotalHeight(dimensions());
        const b = dimensions().bleed;

        canvasRef.width = (totalW + b * 2) * scale;
        canvasRef.height = (totalH + b * 2) * scale;

        // Build config for live canvas overlay rendering
        const config = {
            dimensions: dimensions(),
            scale: scale,
            backgroundColor: backgroundColor(),
            imgObj: imgObj,
            imgState: imgState(),
            imageSelected: imageSelected(),
            textColor: textColor(),
            artistName: getArtistName(),
            albumTitle: getAlbumTitle(),
            spineFontSize: spineFontSize(),
            tracklistText: tracklistText(),
            tracklistFontSize: tracklistFontSize(),
            tracklistLinePadding: tracklistLinePadding(),
            livePreview: true // Flag to draw cutting guides
        };

        renderCover(ctx, config);
    };

    const exportPDF = () => {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const totalW = getTotalWidth(dimensions());
        const totalH = getTotalHeight(dimensions());
        const b = dimensions().bleed;
        const a4w = 297;
        const a4h = 210;
        const x = (a4w - totalW) / 2;
        const y = (a4h - totalH) / 2;

        const printCanvas = document.createElement('canvas');
        const scale = 2.5; // Reduced from 4 to prevent large canvas memory issues
        // 3.7795 px/mm * 2.5 ~= 9.5 px/mm ~= 240 DPI. Sufficient for print.
        printCanvas.width = (totalW + b * 2) * 3.7795 * scale;
        printCanvas.height = (totalH + b * 2) * 3.7795 * scale;
        const ctx = printCanvas.getContext('2d');

        // Build config for high-DPI PDF printing
        const config = {
            dimensions: dimensions(),
            scale: 3.7795 * scale,
            backgroundColor: backgroundColor(),
            imgObj: imgObj,
            imgState: imgState(),
            imageSelected: false, // Never draw handles on PDF
            textColor: textColor(),
            artistName: getArtistName(),
            albumTitle: getAlbumTitle(),
            spineFontSize: spineFontSize(),
            tracklistText: tracklistText(),
            tracklistFontSize: tracklistFontSize(),
            tracklistLinePadding: tracklistLinePadding(),
            livePreview: false // Do not draw guides or placeholders
        };

        // Leverage the universal render mapping function!
        renderCover(ctx, config);

        const imgData = printCanvas.toDataURL('image/jpeg', 1.0);
        doc.addImage(imgData, 'JPEG', x - b, y - b, totalW + b * 2, totalH + b * 2);

        doc.setDrawColor(0); doc.setLineWidth(0.1);
        const cl = 5; const co = b + 2;
        doc.line(x, y - co, x, y - co - cl); doc.line(x - co, y, x - co - cl, y);
        doc.line(x + totalW, y - co, x + totalW, y - co - cl); doc.line(x + totalW + co, y, x + totalW + co + cl, y);
        doc.line(x, y + totalH + co, x, y + totalH + co + cl); doc.line(x - co, y + totalH, x - co - cl, y + totalH);
        doc.line(x + totalW, y + totalH + co, x + totalW, y + totalH + co + cl); doc.line(x + totalW + co, y + totalH, x + totalW + co + cl, y + totalH);

        // Fold marks (blue)
        doc.setDrawColor(0, 0, 255);
        doc.setLineWidth(0.05);
        const foldMarkLength = 3;

        // Spine fold (between rear tab and spine)
        const spineFoldX = x + dimensions().backWidth;
        doc.line(spineFoldX, y - co, spineFoldX, y - co - foldMarkLength);
        doc.line(spineFoldX, y + totalH + co, spineFoldX, y + totalH + co + foldMarkLength);

        // Spine/Front fold (between spine and front cover)
        const spineFrontFoldX = x + dimensions().backWidth + dimensions().spineWidth;
        doc.line(spineFrontFoldX, y - co, spineFrontFoldX, y - co - foldMarkLength);
        doc.line(spineFrontFoldX, y + totalH + co, spineFrontFoldX, y + totalH + co + foldMarkLength);

        // Front/Inside panel fold (between front and inside)
        const insideFoldX = x + dimensions().backWidth + dimensions().spineWidth + dimensions().frontWidth;
        doc.line(insideFoldX, y - co, insideFoldX, y - co - foldMarkLength);
        doc.line(insideFoldX, y + totalH + co, insideFoldX, y + totalH + co + foldMarkLength);

        // Fallback if safeName returns empty string or just underscores
        const finalArtist = safeName(artistName) || 'Artist';
        const finalAlbum = safeName(albumTitle) || 'Album';

        const filename = `${finalArtist}-${finalAlbum}-jcard.pdf`;
        console.log("Saving PDF with explicit Blob and file-saver:", filename);

        // Create a named File object (stronger hint for browsers than just a Blob)
        const pdfArrayBuffer = doc.output('arraybuffer');
        try {
            const file = new File([pdfArrayBuffer], filename, { type: 'application/pdf' });
            saveAs(file);
        } catch (e) {
            // Fallback for browsers that don't support File constructor fully
            const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
            saveAs(blob, filename);
        }
    };

    return (
        <div class="editor-container">
            <div
                class="canvas-wrapper"
                style={{ overflow: 'hidden', 'max-height': '600px', border: '1px solid #333', 'margin-bottom': '1rem' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <canvas ref={canvasRef} />
            </div>

            {/* Main Controls Grid */}
            <div style={{ display: 'grid', 'grid-template-columns': '2fr 1fr', gap: '1rem', 'margin-bottom': '1rem' }}>

                {/* Left Column: UI Controls imported through the custom hook/component */}
                <ControlsPanel
                    manualArtist={manualArtist()}
                    setManualArtist={setManualArtist}
                    manualTitle={manualTitle()}
                    setManualTitle={setManualTitle}
                    tracklistText={tracklistText()}
                    setTracklistText={setTracklistText}
                />

                {/* Right Column: Styling Controls extracted to child */}
                <StylePanel
                    handleImageUpload={handleImageUpload}
                    backgroundColor={backgroundColor()}
                    setBackgroundColor={setBackgroundColor}
                    textColor={textColor()}
                    setTextColor={setTextColor}
                    tracklistFontSize={tracklistFontSize()}
                    setTracklistFontSize={setTracklistFontSize}
                    tracklistLinePadding={tracklistLinePadding()}
                    setTracklistLinePadding={setTracklistLinePadding}
                    spineFontSize={spineFontSize()}
                    setSpineFontSize={setSpineFontSize}
                    exportPDF={exportPDF}
                    clearLocalStorage={clearLocalStorage}
                />
            </div>

            {/* Collapsible Dimension Controls */}
            <div class="controls glass-card" style={{ 'margin-bottom': '1rem', padding: '0.5rem 1rem' }}>
                <div
                    onClick={() => setDimensionsExpanded(!dimensionsExpanded())}
                    style={{ cursor: 'pointer', display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'user-select': 'none' }}
                >
                    <strong>Dimensions (mm)</strong>
                    <span style={{ 'font-size': '1.2em' }}>{dimensionsExpanded() ? '▼' : '▶'}</span>
                </div>

                {dimensionsExpanded() && (
                    <div style={{ 'margin-top': '1rem', display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'justify-content': 'center' }}>
                        <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>Rear: <CustomNumberInput value={dimensions().backWidth} onInput={(val) => setDimensions({ ...dimensions(), backWidth: val })} style={{ width: '60px' }} /></label>
                        <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>Spine: <CustomNumberInput value={dimensions().spineWidth} onInput={(val) => setDimensions({ ...dimensions(), spineWidth: val })} style={{ width: '60px' }} /></label>
                        <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>Front: <CustomNumberInput value={dimensions().frontWidth} onInput={(val) => setDimensions({ ...dimensions(), frontWidth: val })} style={{ width: '60px' }} /></label>
                        <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>Inside: <CustomNumberInput value={dimensions().insideWidth} onInput={(val) => setDimensions({ ...dimensions(), insideWidth: val })} style={{ width: '60px' }} /></label>
                        <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>Height: <CustomNumberInput value={dimensions().frontHeight} onInput={(val) => setDimensions({ ...dimensions(), frontHeight: val, spineHeight: val, backHeight: val })} style={{ width: '60px' }} /></label>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Editor;
