import { createSignal, createEffect, onMount } from 'solid-js';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';

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
    TEXT_COLOR: 'md-cover-text-color',
    UPLOADED_IMAGE: 'md-cover-uploaded-image',
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

    // Interaction State
    let isDragging = false;
    let activeHandle = null;
    let startDragMs = { x: 0, y: 0 };
    let startImgState = { x: 0, y: 0, scale: 1.0 };

    // Helper functions to get artist/title with manual override
    const getArtistName = () => {
        return manualArtist() || props.release?.['artist-credit']?.[0]?.name || 'Artist Name';
    };

    const getAlbumTitle = () => {
        return manualTitle() || props.release?.title || 'Album Title';
    };

    // Clear local storage and reset to defaults
    const clearLocalStorage = () => {
        if (confirm('Clear all saved progress? This cannot be undone.')) {
            Object.values(STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            setManualArtist('');
            setManualTitle('');
            setDimensions({ ...DEFAULTS });
            setBackgroundColor('#ffffff');
            setDimensions({ ...DEFAULTS });
            setBackgroundColor('#ffffff');
            setTextColor('#000000');
            setTracklistFontSize(3.2);
            setTracklistLinePadding(1.4);
            setSpineFontSize(0);
            setImgState({ x: 0, y: 0, scale: 1.0 });
            imgObj = null;
            draw();
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
                localStorage.setItem(STORAGE_KEYS.UPLOADED_IMAGE, event.target.result);

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
        localStorage.setItem(STORAGE_KEYS.MANUAL_ARTIST, manualArtist());
    });

    createEffect(() => {
        localStorage.setItem(STORAGE_KEYS.MANUAL_TITLE, manualTitle());
    });

    createEffect(() => {
        localStorage.setItem(STORAGE_KEYS.DIMENSIONS, JSON.stringify(dimensions()));
    });

    createEffect(() => {
        localStorage.setItem(STORAGE_KEYS.BG_COLOR, backgroundColor());
    });

    createEffect(() => {
        localStorage.setItem(STORAGE_KEYS.TEXT_COLOR, textColor());
    });

    createEffect(() => {
        localStorage.setItem(STORAGE_KEYS.TRACKLIST_FONT_SIZE, tracklistFontSize());
    });

    createEffect(() => {
        localStorage.setItem(STORAGE_KEYS.TRACKLIST_LINE_PADDING, tracklistLinePadding());
    });

    createEffect(() => {
        localStorage.setItem(STORAGE_KEYS.SPINE_FONT_SIZE, spineFontSize());
    });

    createEffect(() => {
        localStorage.setItem(STORAGE_KEYS.TRACKLIST_TEXT, tracklistText());
    });

    createEffect(() => {
        localStorage.setItem(STORAGE_KEYS.IMAGE_STATE, JSON.stringify(imgState()));
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

    const getTotalWidth = () => dimensions().backWidth + dimensions().spineWidth + dimensions().frontWidth + dimensions().insideWidth;
    const getTotalHeight = () => dimensions().frontHeight;

    const getImgGeo = () => {
        if (!imgObj) return null;
        const w = dimensions().frontWidth * imgState().scale;
        const h = w * (imgObj.height / imgObj.width);
        return { x: imgState().x, y: imgState().y, w, h };
    };

    const screenToMm = (sx, sy) => {
        if (!canvasRef) return { x: 0, y: 0 };
        const rect = canvasRef.getBoundingClientRect();
        const pxX = sx - rect.left;
        const pxY = sy - rect.top;
        const scalePxPerMm = zoom() * 3.7795;
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

        const tol = 2 / zoom();

        // Check if clicking on resize handles (only if image is selected)
        if (imageSelected()) {
            if (Math.abs(mmPos.x - geo.x) < tol && Math.abs(mmPos.y - geo.y) < tol) activeHandle = 'tl';
            else if (Math.abs(mmPos.x - (geo.x + geo.w)) < tol && Math.abs(mmPos.y - geo.y) < tol) activeHandle = 'tr';
            else if (Math.abs(mmPos.x - geo.x) < tol && Math.abs(mmPos.y - (geo.y + geo.h)) < tol) activeHandle = 'bl';
            else if (Math.abs(mmPos.x - (geo.x + geo.w)) < tol && Math.abs(mmPos.y - (geo.y + geo.h)) < tol) activeHandle = 'br';
        }

        // Check if clicking on image body
        if (mmPos.x > geo.x && mmPos.x < geo.x + geo.w && mmPos.y > geo.y && mmPos.y < geo.y + geo.h) {
            if (!activeHandle) {
                activeHandle = 'move';
            }
            setImageSelected(true);
        } else {
            // Clicked outside image
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
        const totalW = getTotalWidth();
        const totalH = getTotalHeight();
        const b = dimensions().bleed;

        canvasRef.width = (totalW + b * 2) * scale;
        canvasRef.height = (totalH + b * 2) * scale;
        ctx.scale(scale, scale);
        ctx.translate(b, b);

        ctx.fillStyle = backgroundColor();
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

            // Only show bounding box when image is selected
            if (imageSelected()) {
                ctx.save();
                ctx.translate(imgAreaX, 0);
                ctx.strokeStyle = '#00aaff';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(geo.x, geo.y, geo.w, geo.h);

                const hw = 1.5;
                ctx.fillStyle = '#ffffff';
                const drawHandle = (hx, hy) => {
                    ctx.fillRect(hx - hw, hy - hw, hw * 2, hw * 2);
                    ctx.strokeRect(hx - hw, hy - hw, hw * 2, hw * 2);
                };
                drawHandle(geo.x, geo.y);
                drawHandle(geo.x + geo.w, geo.y);
                drawHandle(geo.x, geo.y + geo.h);
                drawHandle(geo.x + geo.w, geo.y + geo.h);
                ctx.restore();
            }
        }

        ctx.lineWidth = 0.3;
        ctx.strokeStyle = '#e91e63';
        ctx.strokeRect(0, 0, totalW, totalH);

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

        ctx.strokeStyle = '#cccccc';
        ctx.setLineDash([1, 1]);
        ctx.strokeRect(-b, -b, totalW + b * 2, totalH + b * 2);
        ctx.setLineDash([]);

        // Use manual input or MusicBrainz data
        const artistName = getArtistName();
        const albumTitle = getAlbumTitle();

        // Spine Text - Artist on left (top), Title on right (bottom)
        ctx.save();
        const spineX = dimensions().backWidth + dimensions().spineWidth / 2;
        const spineY = dimensions().spineHeight / 2;
        ctx.translate(spineX, spineY);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = textColor();
        ctx.textBaseline = 'middle';
        const fontSize = spineFontSize() > 0 ? spineFontSize() : dimensions().spineWidth * 0.85;
        ctx.font = `${fontSize}px 'Anton', sans-serif`;

        // Artist on left (top when rotated)
        ctx.textAlign = 'left';
        ctx.fillText(artistName.toUpperCase(), -dimensions().spineHeight / 2 + 2, 0.5);

        // Title on right (bottom when rotated)
        ctx.textAlign = 'right';
        ctx.fillText(albumTitle.toUpperCase(), dimensions().spineHeight / 2 - 2, 0.5);
        ctx.restore();

        // Rear Tab Text (Far Left)
        // Artist name, Anton font, bottom to top
        ctx.save();
        // Center horizontally in the tab
        const rearX = dimensions().backWidth / 1.6;
        // Move Y to bottom edge minus padding
        const rearY = dimensions().backHeight - 1;

        ctx.translate(rearX, rearY);
        ctx.rotate(-Math.PI / 2);

        ctx.fillStyle = textColor();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Fit to tab width (backWidth default 11mm).
        const antonSize = dimensions().backWidth * 0.9;
        ctx.font = `${antonSize}px 'Anton', sans-serif`;
        ctx.fillText(artistName.toUpperCase(), 0, 0);
        ctx.restore();

        if (tracklistText()) {
            const tracks = tracklistText().split('\n');
            ctx.save();
            const panelX = dimensions().backWidth + dimensions().spineWidth + dimensions().frontWidth;
            ctx.translate(panelX, 0);

            ctx.fillStyle = textColor();
            ctx.font = `${tracklistFontSize()}px 'Actor', sans-serif`;
            ctx.textAlign = 'center';
            const lineHeight = tracklistFontSize() * tracklistLinePadding();
            const maxWidth = dimensions().insideWidth - 4;

            // Helper to wrap text
            const wrapText = (text) => {
                const words = text.split(' ');
                let lines = [];
                let currentLine = words[0];

                for (let i = 1; i < words.length; i++) {
                    const word = words[i];
                    const width = ctx.measureText(currentLine + " " + word).width;
                    if (width < maxWidth) {
                        currentLine += " " + word;
                    } else {
                        lines.push(currentLine);
                        currentLine = word;
                    }
                }
                lines.push(currentLine);
                return lines;
            };

            let allLines = [];
            tracks.forEach((trackTitle) => {
                const lines = wrapText(trackTitle);
                allLines = allLines.concat(lines);
            });

            const totalTextHeight = allLines.length * lineHeight;
            const startY = (dimensions().frontHeight - totalTextHeight) / 2 + (lineHeight / 2);

            allLines.forEach((line, i) => {
                ctx.fillText(line, dimensions().insideWidth / 2, startY + (i * lineHeight));
            });

            ctx.restore();
        } else {
            ctx.fillStyle = '#999';
            ctx.font = '3px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("Inside Panel", dimensions().backWidth + dimensions().spineWidth + dimensions().frontWidth + dimensions().insideWidth / 2, dimensions().frontHeight / 2);
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
        const scale = 2.5; // Reduced from 4 to prevent large canvas memory issues
        // 3.7795 px/mm * 2.5 ~= 9.5 px/mm ~= 240 DPI. Sufficient for print.
        printCanvas.width = (totalW + b * 2) * 3.7795 * scale;
        printCanvas.height = (totalH + b * 2) * 3.7795 * scale;
        const ctx = printCanvas.getContext('2d');
        ctx.scale(3.7795 * scale, 3.7795 * scale);
        ctx.translate(b, b);

        ctx.fillStyle = backgroundColor();
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

        // Use manual input or MusicBrainz data
        const artistName = getArtistName();
        const albumTitle = getAlbumTitle();

        // Spine Text - Artist on left (top), Title on right (bottom)
        ctx.save();
        const spineX = dimensions().backWidth + dimensions().spineWidth / 2;
        const spineY = dimensions().spineHeight / 2;
        ctx.translate(spineX, spineY);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = textColor();
        ctx.textBaseline = 'middle';
        const fontSize = spineFontSize() > 0 ? spineFontSize() : dimensions().spineWidth * 0.85;
        // Map px to pt for PDF if needed, but here we are drawing to canvas first, so 1:1 mm mapping is maintained by scale.
        ctx.font = `${fontSize}px 'Anton', sans-serif`;

        // Artist on left (top when rotated)
        ctx.textAlign = 'left';
        ctx.fillText(artistName.toUpperCase(), -dimensions().spineHeight / 2 + 2, 0.5);

        // Title on right (bottom when rotated)
        ctx.textAlign = 'right';
        ctx.fillText(albumTitle.toUpperCase(), dimensions().spineHeight / 2 - 2, 0.5);
        ctx.restore();

        // Rear Tab Text (Far Left)
        ctx.save();
        const rearX = dimensions().backWidth / 1.6;
        const rearY = dimensions().backHeight - 1;
        ctx.translate(rearX, rearY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = textColor();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const antonSize = dimensions().backWidth * 0.9;
        ctx.font = `${antonSize}px 'Anton', sans-serif`;
        ctx.fillText(artistName.toUpperCase(), 0, 0);
        ctx.restore();

        if (tracklistText()) {
            const tracks = tracklistText().split('\n');
            ctx.save();
            const panelX = dimensions().backWidth + dimensions().spineWidth + dimensions().frontWidth;
            ctx.translate(panelX, 0);

            ctx.fillStyle = textColor();
            ctx.font = `${tracklistFontSize()}px 'Actor', sans-serif`;
            ctx.textAlign = 'center';
            const lineHeight = tracklistFontSize() * tracklistLinePadding();
            const maxWidth = dimensions().insideWidth - 4;

            // Helper to wrap text
            const wrapText = (text) => {
                const words = text.split(' ');
                let lines = [];
                let currentLine = words[0];

                for (let i = 1; i < words.length; i++) {
                    const word = words[i];
                    const width = ctx.measureText(currentLine + " " + words[i]).width;
                    if (width < maxWidth) {
                        currentLine += " " + words[i];
                    } else {
                        lines.push(currentLine);
                        currentLine = words[i];
                    }
                }
                lines.push(currentLine);
                return lines;
            };

            let allLines = [];
            tracks.forEach((trackTitle) => {
                const lines = wrapText(trackTitle);
                allLines = allLines.concat(lines);
            });

            const totalTextHeight = allLines.length * lineHeight;
            let startY = (dimensions().frontHeight - totalTextHeight) / 2;
            if (startY < 5) startY = 5;

            let currentY = startY;
            allLines.forEach(line => {
                ctx.fillText(line, dimensions().insideWidth / 2, currentY);
                currentY += lineHeight;
            });
            ctx.restore();
        }

        const imgData = printCanvas.toDataURL('image/jpeg', 1.0);
        doc.addImage(imgData, 'JPEG', x - b, y - b, totalW + b * 2, totalH + b * 2);

        // Removed: Red border rectangle
        // doc.setDrawColor(200, 0, 0); doc.setLineWidth(0.1); doc.rect(x, y, totalW, totalH);

        // Removed: Dashed blue fold lines
        // doc.setDrawColor(0, 100, 200); doc.setLineDashPattern([1, 1], 0);
        // let fx = x + dimensions().backWidth; doc.line(fx, y, fx, y + totalH);
        // fx += dimensions().spineWidth; doc.line(fx, y, fx, y + totalH);
        // fx += dimensions().frontWidth; doc.line(fx, y, fx, y + totalH);
        // doc.setLineDashPattern([], 0);

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

        // Save Logic
        const safeName = (str) => (str || 'unknown').replace(/[^a-z0-9\-\s]/gi, '').trim().replace(/\s+/g, '_');

        const artist = getArtistName();
        const album = getAlbumTitle();
        const filename = `${safeName(artist)}-${safeName(album)}-jcard.pdf`;
        console.log("Saving PDF with FileSaver:", filename);

        const pdfBlob = doc.output('blob');
        saveAs(pdfBlob, filename);
    };

    return (
        <div class="editor-container">
            {/* Manual Input Controls */}
            <div class="controls glass-card" style={{ 'margin-bottom': '1rem', padding: '1rem' }}>
                <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr 1fr', gap: '2rem', 'align-items': 'end' }}>
                    <div>
                        <label style={{ display: 'block', 'margin-bottom': '0.25rem', 'font-size': '0.9em' }}>Artist Name (optional):</label>
                        <input
                            type="text"
                            placeholder="Override MusicBrainz artist..."
                            value={manualArtist()}
                            onInput={(e) => setManualArtist(e.target.value)}
                            style={{ width: '100%', 'box-sizing': 'border-box' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', 'margin-bottom': '0.25rem', 'font-size': '0.9em' }}>Album Title (optional):</label>
                        <input
                            type="text"
                            placeholder="Override MusicBrainz title..."
                            value={manualTitle()}
                            onInput={(e) => setManualTitle(e.target.value)}
                            style={{ width: '100%', 'box-sizing': 'border-box' }}
                        />
                    </div>

                    <div style={{ 'grid-column': '1 / -1' }}>
                        <label style={{ display: 'block', 'margin-bottom': '0.25rem', 'font-size': '0.9em' }}>Tracklist:</label>
                        <textarea
                            value={tracklistText()}
                            onInput={(e) => setTracklistText(e.target.value)}
                            placeholder="1. Track One... (one per line)"
                            style={{ width: '100%', 'box-sizing': 'border-box', 'min-height': '150px', 'font-family': 'monospace', padding: '0.5rem' }}
                        ></textarea>
                        <small style={{ color: 'var(--text-secondary)' }}>Edit tracks here. One track per line.</small>
                    </div>

                    <div>
                        <label style={{ display: 'block', 'margin-bottom': '0.25rem', 'font-size': '0.9em' }}>Upload Cover Image:</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            style={{ width: '100%', height: '38px', padding: '0.5rem', 'box-sizing': 'border-box' }}
                        />
                    </div>
                </div>
                <div style={{ 'margin-top': '0.5rem', 'font-size': '0.85em', color: 'var(--text-secondary)' }}>
                    <small>💡 Manual inputs override MusicBrainz data. Click image to select/deselect and show resize handles.</small>
                </div>
            </div>

            {/* Color Pickers and Clear Progress */}
            <div class="controls glass-card" style={{ 'margin-bottom': '1rem', padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', 'align-items': 'center', 'justify-content': 'center', 'flex-wrap': 'wrap' }}>
                    <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
                        Background:


                        <div style={{ position: 'relative', width: '30px', height: '30px' }}>
                            <div style={{
                                position: 'absolute',
                                left: 0, top: 0,
                                width: '100%', height: '100%',
                                background: backgroundColor(),
                                border: '2px solid var(--text-secondary)',
                                'border-radius': '4px',
                                'pointer-events': 'none'
                            }}></div>
                            <input
                                type="color"
                                value={backgroundColor()}
                                onInput={(e) => setBackgroundColor(e.target.value)}
                                style={{
                                    width: '100%', height: '100%',
                                    opacity: 0, cursor: 'pointer',
                                    padding: 0, border: 'none'
                                }}
                            />
                        </div>
                    </label>

                    <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
                        Text:

                        <div style={{ position: 'relative', width: '30px', height: '30px' }}>
                            <div style={{
                                position: 'absolute',
                                left: 0, top: 0,
                                width: '100%', height: '100%',
                                background: textColor(),
                                border: '2px solid var(--text-secondary)',
                                'border-radius': '4px',
                                'pointer-events': 'none'
                            }}></div>
                            <input
                                type="color"
                                value={textColor()}
                                onInput={(e) => setTextColor(e.target.value)}
                                style={{
                                    width: '100%', height: '100%',
                                    opacity: 0, cursor: 'pointer',
                                    padding: 0, border: 'none'
                                }}
                            />
                        </div>
                    </label>

                    <div style={{ width: '1px', height: '30px', background: 'var(--text-secondary)', opacity: '0.3', margin: '0 0.5rem' }}></div>

                    <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
                        Size:
                        <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="10"
                            value={tracklistFontSize()}
                            onInput={(e) => setTracklistFontSize(Number(e.target.value))}
                            style={{ width: '50px', padding: '0.25rem' }}
                        />
                    </label>

                    <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
                        Line Padding:
                        <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="3"
                            value={tracklistLinePadding()}
                            onInput={(e) => setTracklistLinePadding(Number(e.target.value))}
                            style={{ width: '50px', padding: '0.25rem' }}
                        />
                    </label>

                    <label style={{ display: 'flex', 'align-items': 'center', gap: '0.5rem' }}>
                        Spine Font:
                        <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="20"
                            placeholder="Auto"
                            value={spineFontSize() === 0 ? '' : spineFontSize()}
                            onInput={(e) => setSpineFontSize(Number(e.target.value))}
                            style={{ width: '50px', padding: '0.25rem' }}
                        />
                    </label>

                    <div style={{ width: '1px', height: '30px', background: 'var(--text-secondary)', opacity: '0.3', margin: '0 0.5rem' }}></div>

                    <button onClick={clearLocalStorage} style={{ padding: '0.5rem 1rem', background: '#e74c3c', color: 'white', border: 'none', 'border-radius': '4px', cursor: 'pointer' }}>
                        Clear Progress
                    </button>
                </div>
            </div>

            {/* Collapsible Dimension Controls */}
            <div class="controls glass-card" style={{ 'margin-bottom': '1rem', padding: '1rem' }}>
                <div
                    onClick={() => setDimensionsExpanded(!dimensionsExpanded())}
                    style={{ cursor: 'pointer', display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'user-select': 'none' }}
                >
                    <strong>Dimensions (mm)</strong>
                    <span style={{ 'font-size': '1.2em' }}>{dimensionsExpanded() ? '▼' : '▶'}</span>
                </div>

                {dimensionsExpanded() && (
                    <div style={{ 'margin-top': '1rem', display: 'flex', gap: '1rem', 'flex-wrap': 'wrap', 'justify-content': 'center' }}>
                        <label>Rear: <input type="number" value={dimensions().backWidth} onInput={(e) => setDimensions({ ...dimensions(), backWidth: Number(e.target.value) })} style={{ width: '50px' }} /></label>
                        <label>Spine: <input type="number" value={dimensions().spineWidth} onInput={(e) => setDimensions({ ...dimensions(), spineWidth: Number(e.target.value) })} style={{ width: '40px' }} /></label>
                        <label>Front: <input type="number" value={dimensions().frontWidth} onInput={(e) => setDimensions({ ...dimensions(), frontWidth: Number(e.target.value) })} style={{ width: '50px' }} /></label>
                        <label>Inside: <input type="number" value={dimensions().insideWidth} onInput={(e) => setDimensions({ ...dimensions(), insideWidth: Number(e.target.value) })} style={{ width: '50px' }} /></label>
                        <label>Height: <input type="number" value={dimensions().frontHeight} onInput={(e) => { const val = Number(e.target.value); setDimensions({ ...dimensions(), frontHeight: val, spineHeight: val, backHeight: val }) }} style={{ width: '50px' }} /></label>
                    </div>
                )}
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
