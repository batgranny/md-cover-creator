import { createSignal, createEffect, onMount } from 'solid-js';
import { jsPDF } from 'jspdf';

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

function Editor(props) {
    const [dimensions, setDimensions] = createSignal({ ...DEFAULTS });
    const [zoom, setZoom] = createSignal(1.2);

    // Image State: x, y (mm), scale
    const [imgState, setImgState] = createSignal({ x: 0, y: 0, scale: 1.0 });

    let canvasRef;
    let imgObj = null;

    // Interaction State
    let isDragging = false;
    let activeHandle = null; // 'tl', 'tr', 'bl', 'br' or null
    let startDragMs = { x: 0, y: 0 };
    let startImgState = { x: 0, y: 0, scale: 1.0 };

    // Load image when release changes
    createEffect(() => {
        if (props.release) {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = `https://coverartarchive.org/release/${props.release.id}/front`;
            img.onload = () => {
                imgObj = img;
                // Fit to width by default
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

    createEffect(() => {
        dimensions();
        zoom();
        imgState();
        draw();
    });

    const getTotalWidth = () => dimensions().backWidth + dimensions().spineWidth + dimensions().frontWidth + dimensions().insideWidth;
    const getTotalHeight = () => dimensions().frontHeight;

    // Helper: Get Image Geometry in mm relative to Front Panel Origin
    const getImgGeo = () => {
        if (!imgObj) return null;
        const w = dimensions().frontWidth * imgState().scale;
        const h = w * (imgObj.height / imgObj.width);
        return { x: imgState().x, y: imgState().y, w, h };
    };

    // Helper: Screen pixel to canvas mm (relative to front panel origin)
    const screenToMm = (sx, sy) => {
        if (!canvasRef) return { x: 0, y: 0 };
        const rect = canvasRef.getBoundingClientRect();
        const pxX = sx - rect.left;
        const pxY = sy - rect.top;

        const scalePxPerMm = zoom() * 3.7795;
        // Canvas origin (0,0) starts at bleed top-left.
        // Front Panel Origin is at: bleed + back + spine
        const originX = (dimensions().bleed + dimensions().backWidth + dimensions().spineWidth) * scalePxPerMm;
        const originY = dimensions().bleed * scalePxPerMm;

        const mmX = (pxX - originX) / scalePxPerMm;
        const mmY = (pxY - originY) / scalePxPerMm;
        return { x: mmX, y: mmY };
    };

    const handleMouseDown = (e) => {
        const mmPos = screenToMm(e.clientX, e.clientY);
        const geo = getImgGeo();
        if (!geo) return;

        // Hit test handles (approx tolerance 2mm)
        const tol = 2 / zoom();

        if (Math.abs(mmPos.x - geo.x) < tol && Math.abs(mmPos.y - geo.y) < tol) activeHandle = 'tl';
        else if (Math.abs(mmPos.x - (geo.x + geo.w)) < tol && Math.abs(mmPos.y - geo.y) < tol) activeHandle = 'tr';
        else if (Math.abs(mmPos.x - geo.x) < tol && Math.abs(mmPos.y - (geo.y + geo.h)) < tol) activeHandle = 'bl';
        else if (Math.abs(mmPos.x - (geo.x + geo.w)) < tol && Math.abs(mmPos.y - (geo.y + geo.h)) < tol) activeHandle = 'br';
        else if (mmPos.x > geo.x && mmPos.x < geo.x + geo.w && mmPos.y > geo.y && mmPos.y < geo.y + geo.h) activeHandle = 'move';

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

        // Current Image Aspect Ratio
        const aspect = imgObj ? imgObj.height / imgObj.width : 1;
        const baseW = dimensions().frontWidth * startImgState.scale;

        if (activeHandle === 'move') {
            setImgState({
                ...imgState(),
                x: startImgState.x + dx,
                y: startImgState.y + dy
            });
        } else if (activeHandle === 'br') {
            // New Width = Old Width + dx
            const newW = Math.max(5, baseW + dx);
            const newScale = newW / dimensions().frontWidth;
            setImgState({ ...imgState(), scale: newScale });
        } else if (activeHandle === 'bl') {
            // Anchor TR. x changes, w changes.
            // New W = Old W - dx
            const newW = Math.max(5, baseW - dx);
            const newScale = newW / dimensions().frontWidth;
            // New X = Old X + dx
            const newX = startImgState.x + dx;
            // Y is fixed (top)
            setImgState({ ...imgState(), scale: newScale, x: newX });
        } else if (activeHandle === 'tr') {
            // Anchor BL.
            // New W = Old W + dx.
            const newW = Math.max(5, baseW + dx);
            const newScale = newW / dimensions().frontWidth;

            // New H = New W * Aspect. Old H = BaseW * Aspect.
            // dH = NewH - OldH.
            // New Y = Old Y - dH (since we are dragging Top, Y moves up)
            // But we can simplify: Top changes by dy? No, aspect lock.
            // If dragging TR, W changes by dx. H changes proportionally.
            // Top Y moves up by (NewH - OldH).
            const oldH = baseW * aspect;
            const newH = newW * aspect;
            setImgState({ ...imgState(), scale: newScale, y: startImgState.y - (newH - oldH) });
        } else if (activeHandle === 'tl') {
            // Anchor BR.
            const newW = Math.max(5, baseW - dx);
            const newScale = newW / dimensions().frontWidth;
            const newX = startImgState.x + dx;

            const oldH = baseW * aspect;
            const newH = newW * aspect;

            setImgState({ ...imgState(), scale: newScale, x: newX, y: startImgState.y - (newH - oldH) });
        }
    };

    const handleMouseUp = () => {
        isDragging = false;
        activeHandle = null;
    };

    const draw = () => {
        if (!canvasRef) return;
        const ctx = canvasRef.getContext('2d');
        const scale = zoom() * 3.7795;

        const totalW = getTotalWidth();
        const totalH = getTotalHeight();
        const b = dimensions().bleed;

        canvasRef.width = (totalW + b * 2) * scale;
        canvasRef.height = (totalH + b * 2) * scale;
        ctx.scale(scale, scale);
        ctx.translate(b, b);

        // BG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-b, -b, totalW + b * 2, totalH + b * 2);

        // Image with Clipping
        if (imgObj) {
            const imgAreaX = dimensions().backWidth + dimensions().spineWidth;
            const imgAreaW = dimensions().frontWidth;
            const imgAreaH = dimensions().frontHeight;

            ctx.save();
            ctx.beginPath();
            ctx.rect(imgAreaX, -b, imgAreaW, imgAreaH + b * 2);
            ctx.clip();

            // Draw Image
            const geo = getImgGeo();
            ctx.drawImage(imgObj, imgAreaX + geo.x, geo.y, geo.w, geo.h);

            ctx.restore();

            // Draw Handles (Outside clip, visual helper)
            // Transform to Front Panel Origin
            ctx.save();
            ctx.translate(imgAreaX, 0);

            // Draw Bounding Box (Visual only)
            ctx.strokeStyle = '#00aaff';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(geo.x, geo.y, geo.w, geo.h);

            // Handles
            const hw = 1.5; // Handle size half-width (mm)
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#00aaff';

            const drawHandle = (hx, hy) => {
                ctx.fillRect(hx - hw, hy - hw, hw * 2, hw * 2);
                ctx.strokeRect(hx - hw, hy - hw, hw * 2, hw * 2);
            };

            drawHandle(geo.x, geo.y); // TL
            drawHandle(geo.x + geo.w, geo.y); // TR
            drawHandle(geo.x, geo.y + geo.h); // BL
            drawHandle(geo.x + geo.w, geo.y + geo.h); // BR

            ctx.restore();
        }

        // Overlay Lines
        ctx.lineWidth = 0.3;

        // Cut Lines (Pink)
        ctx.strokeStyle = '#e91e63';
        ctx.strokeRect(0, 0, totalW, totalH);

        // Fold Lines (Blue Dashed)
        ctx.strokeStyle = '#2196f3';
        ctx.setLineDash([1, 1]);
        ctx.beginPath();
        let x = dimensions().backWidth;
        ctx.moveTo(x, 0); ctx.lineTo(x, totalH);
        x += dimensions().spineWidth;
        ctx.moveTo(x, 0); ctx.lineTo(x, totalH);
        x += dimensions().frontWidth;
        ctx.moveTo(x, 0); ctx.lineTo(x, totalH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Bleed (Grey)
        ctx.strokeStyle = '#cccccc';
        ctx.setLineDash([1, 1]);
        ctx.strokeRect(-b, -b, totalW + b * 2, totalH + b * 2);
        ctx.setLineDash([]);

        // Spine Text
        if (props.release) {
            ctx.save();
            const spineX = dimensions().backWidth + dimensions().spineWidth / 2;
            const spineY = dimensions().spineHeight / 2;
            ctx.translate(spineX, spineY);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const fontSize = Math.min(3, dimensions().spineWidth * 0.6);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillText(`${props.release['artist-credit']?.[0]?.name} - ${props.release.title}`, 0, 0);
            ctx.restore();
        }

        // Tracklist
        if (props.release?.media?.[0]?.tracks?.length > 0) {
            const tracks = props.release.media[0].tracks;
            ctx.save();
            const panelX = dimensions().backWidth + dimensions().spineWidth + dimensions().frontWidth;
            ctx.translate(panelX, 0);

            // Title (Album Name)
            ctx.fillStyle = '#000';
            ctx.font = 'bold 3px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(props.release.title, 2, 4);

            // List Tracks
            ctx.font = '3.6px sans-serif'; // Doubled size
            let currentY = 8;
            const lineHeight = 4.4; // Adjusted for font size

            tracks.forEach((track, i) => {
                if (currentY > dimensions().frontHeight - 2) return;
                const duration = track.length ? ` (${Math.floor(track.length / 60000)}:${String(Math.floor((track.length % 60000) / 1000)).padStart(2, '0')})` : '';
                ctx.fillText(`${i + 1}. ${track.title}${duration}`, 2, currentY);
                currentY += lineHeight;
            });
            ctx.restore();
        } else {
            ctx.fillStyle = '#999';
            ctx.font = '3px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("Inside Panel", dimensions().backWidth + dimensions().spineWidth + dimensions().frontWidth + dimensions().insideWidth / 2, totalH / 2);
        }
    };

    const exportPDF = () => {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const totalW = getTotalWidth();
        const totalH = getTotalHeight();
        const b = dimensions().bleed;

        const a4w = 297;
        const a4h = 210;
        const x = (a4w - totalW) / 2;
        const y = (a4h - totalH) / 2;

        const printCanvas = document.createElement('canvas');
        const scale = 4;
        printCanvas.width = (totalW + b * 2) * 3.7795 * scale;
        printCanvas.height = (totalH + b * 2) * 3.7795 * scale;
        const ctx = printCanvas.getContext('2d');
        ctx.scale(3.7795 * scale, 3.7795 * scale);
        ctx.translate(b, b);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-b, -b, totalW + b * 2, totalH + b * 2);

        if (imgObj) {
            const imgAreaX = dimensions().backWidth + dimensions().spineWidth;
            const geo = getImgGeo();

            ctx.save();
            ctx.beginPath();
            ctx.rect(imgAreaX, -b, dimensions().frontWidth, dimensions().frontHeight + b * 2);
            ctx.clip();
            ctx.drawImage(imgObj, imgAreaX + geo.x, geo.y, geo.w, geo.h);
            ctx.restore();
        }

        // Spine Text
        if (props.release) {
            ctx.save();
            const spineX = dimensions().backWidth + dimensions().spineWidth / 2;
            const spineY = dimensions().spineHeight / 2;
            ctx.translate(spineX, spineY);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const fontSize = Math.min(3, dimensions().spineWidth * 0.6);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillText(`${props.release['artist-credit']?.[0]?.name} - ${props.release.title}`, 0, 0);
            ctx.restore();
        }

        // Tracklist
        if (props.release?.media?.[0]?.tracks?.length > 0) {
            const tracks = props.release.media[0].tracks;
            ctx.save();
            const panelX = dimensions().backWidth + dimensions().spineWidth + dimensions().frontWidth;
            ctx.translate(panelX, 0);

            // Title (Album Name)
            ctx.fillStyle = '#000';
            ctx.font = 'bold 3px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(props.release.title, 2, 4);

            // List Tracks
            ctx.font = '3.6px sans-serif'; // Doubled size
            let currentY = 8;
            const lineHeight = 4.4;

            tracks.forEach((track, i) => {
                if (currentY > dimensions().frontHeight - 2) return;
                const duration = track.length ? ` (${Math.floor(track.length / 60000)}:${String(Math.floor((track.length % 60000) / 1000)).padStart(2, '0')})` : '';
                ctx.fillText(`${i + 1}. ${track.title}${duration}`, 2, currentY);
                currentY += lineHeight;
            });
            ctx.restore();
        }

        const imgData = printCanvas.toDataURL('image/jpeg', 1.0);
        doc.addImage(imgData, 'JPEG', x - b, y - b, totalW + b * 2, totalH + b * 2);

        // Lines
        doc.setDrawColor(200, 0, 0); doc.setLineWidth(0.1); doc.rect(x, y, totalW, totalH);
        doc.setDrawColor(0, 100, 200); doc.setLineDashPattern([1, 1], 0);
        let fx = x + dimensions().backWidth; doc.line(fx, y, fx, y + totalH);
        fx += dimensions().spineWidth; doc.line(fx, y, fx, y + totalH);
        fx += dimensions().frontWidth; doc.line(fx, y, fx, y + totalH);
        doc.setLineDashPattern([], 0);

        // Crops
        doc.setDrawColor(0); doc.setLineWidth(0.1);
        const cl = 5; const co = b + 2;
        doc.line(x, y - co, x, y - co - cl); doc.line(x - co, y, x - co - cl, y);
        doc.line(x + totalW, y - co, x + totalW, y - co - cl); doc.line(x + totalW + co, y, x + totalW + co + cl, y);
        doc.line(x, y + totalH + co, x, y + totalH + co + cl); doc.line(x - co, y + totalH, x - co - cl, y + totalH);
        doc.line(x + totalW, y + totalH + co, x + totalW, y + totalH + co + cl); doc.line(x + totalW + co, y + totalH, x + totalW + co + cl, y + totalH);

        const safeName = (str) => (str || '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        let filename = 'minidisc-cover-jcard.pdf';

        if (props.release) {
            const artist = props.release['artist-credit']?.[0]?.name || 'unknown';
            const album = props.release.title || 'untitled';
            filename = `${safeName(artist)}-${safeName(album)}-jcard.pdf`;
        }

        doc.save(filename);
    };

    return (
        <div class="editor-container">
            <div class="controls glass-card" style={{ 'margin-bottom': '1rem', padding: '1rem', display: 'flex', gap: '1rem', 'justify-content': 'center', 'flex-wrap': 'wrap' }}>
                <label>Rear (mm): <input type="number" value={dimensions().backWidth} onInput={(e) => setDimensions({ ...dimensions(), backWidth: Number(e.target.value) })} style={{ width: '50px' }} /></label>
                <label>Spine (mm): <input type="number" value={dimensions().spineWidth} onInput={(e) => setDimensions({ ...dimensions(), spineWidth: Number(e.target.value) })} style={{ width: '40px' }} /></label>
                <label>Front (mm): <input type="number" value={dimensions().frontWidth} onInput={(e) => setDimensions({ ...dimensions(), frontWidth: Number(e.target.value) })} style={{ width: '50px' }} /></label>
                <label>Inside (mm): <input type="number" value={dimensions().insideWidth} onInput={(e) => setDimensions({ ...dimensions(), insideWidth: Number(e.target.value) })} style={{ width: '50px' }} /></label>
                <label>Height (mm): <input type="number" value={dimensions().frontHeight} onInput={(e) => { const val = Number(e.target.value); setDimensions({ ...dimensions(), frontHeight: val, spineHeight: val, backHeight: val }) }} style={{ width: '50px' }} /></label>
                <div style={{ 'margin-left': '1rem', 'display': 'flex', 'align-items': 'center', 'gap': '0.5rem' }}>
                    <small>Drag handles to resize, drag image to move</small>
                </div>
            </div>

            <div
                class="canvas-wrapper"
                style={{ overflow: 'hidden', 'max-height': '600px', border: '1px solid #333' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <canvas ref={canvasRef} />
            </div>

            <div style={{ 'margin-top': '1rem' }}>
                <button onClick={exportPDF} style={{ 'font-weight': 'bold' }}>Download PDF</button>
            </div>
        </div>
    );
}

export default Editor;
