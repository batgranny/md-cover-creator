// renderCover.js
// Extracts the repetitive geometric math for drawing a J-Card given a canvas context and config parameters

export const getTotalWidth = (dimensions) => dimensions.backWidth + dimensions.spineWidth + dimensions.frontWidth + dimensions.insideWidth;
export const getTotalHeight = (dimensions) => dimensions.frontHeight;
export const getImgGeo = (imgObj, imgState, dimensions) => {
    if (!imgObj) return null;
    const w = dimensions.frontWidth * imgState.scale;
    const h = w * (imgObj.height / imgObj.width);
    return { x: imgState.x, y: imgState.y, w, h };
};

export const renderCover = (ctx, config) => {
    const {
        dimensions,
        scale,
        backgroundColor,
        imgObj,
        imgState,
        imageSelected,
        textColor,
        artistName,
        albumTitle,
        spineFontSize,
        tracklistText,
        tracklistFontSize,
        tracklistLinePadding
    } = config;

    const totalW = getTotalWidth(dimensions);
    const totalH = getTotalHeight(dimensions);
    const b = dimensions.bleed;

    ctx.scale(scale, scale);
    ctx.translate(b, b);

    // Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(-b, -b, totalW + b * 2, totalH + b * 2);

    // Image & Clipping Mask
    if (imgObj) {
        const imgAreaX = dimensions.backWidth + dimensions.spineWidth;
        const geo = getImgGeo(imgObj, imgState, dimensions);

        ctx.save();
        ctx.beginPath();
        ctx.rect(imgAreaX, -b, dimensions.frontWidth, dimensions.frontHeight + b * 2);
        ctx.clip();
        ctx.drawImage(imgObj, imgAreaX + geo.x, geo.y, geo.w, geo.h);
        ctx.restore();

        // Optional Interaction Handles (only drawn for live canvas, not PDF)
        // In PDF context, imageSelected should just be passed as false
        if (imageSelected) {
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

    // Cut/Fold Lines (Only for Live UI overlay preview, or PDF outline mask)
    // Note: The PDF `jsPDF` exporter draws its own *vector* lines on top of the image data,
    // so here we only draw the pink/blue dashboard lines if `config.livePreview` is true.
    if (config.livePreview) {
        ctx.lineWidth = 0.3;
        ctx.strokeStyle = '#e91e63';
        ctx.strokeRect(0, 0, totalW, totalH);

        ctx.strokeStyle = '#2196f3';
        ctx.setLineDash([1, 1]);
        ctx.beginPath();
        let x = dimensions.backWidth;
        ctx.moveTo(x, 0); ctx.lineTo(x, totalH);
        x += dimensions.spineWidth;
        ctx.moveTo(x, 0); ctx.lineTo(x, totalH);
        x += dimensions.frontWidth;
        ctx.moveTo(x, 0); ctx.lineTo(x, totalH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = '#cccccc';
        ctx.setLineDash([1, 1]);
        ctx.strokeRect(-b, -b, totalW + b * 2, totalH + b * 2);
        ctx.setLineDash([]);
    }

    // Spine Text - Artist on left (top), Title on right (bottom)
    ctx.save();
    const spineX = dimensions.backWidth + dimensions.spineWidth / 2;
    const spineY = dimensions.spineHeight / 2;
    ctx.translate(spineX, spineY);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'middle';
    let sFontSize = spineFontSize > 0 ? spineFontSize : dimensions.spineWidth * 0.85;

    const artistStr = (artistName || 'Artist').toUpperCase();
    const titleStr = (albumTitle || 'Album').toUpperCase();

    // Calculate required width and scale down if necessary
    ctx.font = `${sFontSize}px 'Anton', sans-serif`;
    const artistWidth = ctx.measureText(artistStr).width;
    const titleWidth = ctx.measureText(titleStr).width;
    const totalTextWidth = artistWidth + titleWidth;

    // Available space is spineHeight minus padding (8mm padding total)
    const availableSpineSpace = dimensions.spineHeight - 8;

    if (totalTextWidth > availableSpineSpace && availableSpineSpace > 0) {
        const scaleFactor = availableSpineSpace / totalTextWidth;
        sFontSize = sFontSize * scaleFactor;
        ctx.font = `${sFontSize}px 'Anton', sans-serif`;
    }

    // Artist on left (top when rotated)
    ctx.textAlign = 'left';
    ctx.fillText(artistStr, -dimensions.spineHeight / 2 + 2, 0.5);

    // Title on right (bottom when rotated)
    ctx.textAlign = 'right';
    ctx.fillText(titleStr, dimensions.spineHeight / 2 - 2, 0.5);
    ctx.restore();

    // Rear Tab Text (Far Left)
    ctx.save();
    const rearX = dimensions.backWidth / 1.6;
    const rearY = dimensions.backHeight - 1;
    ctx.translate(rearX, rearY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let antonSize = dimensions.backWidth * 0.9;
    ctx.font = `${antonSize}px 'Anton', sans-serif`;

    const rearArtistWidth = ctx.measureText(artistStr).width;
    const availableRearSpace = dimensions.backHeight - 2;

    if (rearArtistWidth > availableRearSpace && availableRearSpace > 0) {
        const rearScaleFactor = availableRearSpace / rearArtistWidth;
        antonSize = antonSize * rearScaleFactor;
        ctx.font = `${antonSize}px 'Anton', sans-serif`;
    }

    ctx.fillText(artistStr, 0, 0);
    ctx.restore();

    // Tracklist Panel
    if (tracklistText) {
        const tracks = tracklistText.split('\n');
        ctx.save();
        const panelX = dimensions.backWidth + dimensions.spineWidth + dimensions.frontWidth;
        ctx.translate(panelX, 0);

        ctx.fillStyle = textColor;
        ctx.font = `${tracklistFontSize}px 'Actor', sans-serif`;
        ctx.textAlign = 'center';
        const lineHeight = tracklistFontSize * tracklistLinePadding;
        const maxWidth = dimensions.insideWidth - 4;

        // Helper to wrap text
        const wrapText = (text) => {
            const words = text.split(' ');
            let lines = [];
            let currentLine = words[0];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                if (!word) continue;
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < maxWidth) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            if (currentLine) lines.push(currentLine);
            return lines;
        };

        let allLines = [];
        tracks.forEach((trackTitle) => {
            if (!trackTitle.trim()) return; // skip empty lines silently
            const lines = wrapText(trackTitle);
            allLines = allLines.concat(lines);
        });

        const totalTextHeight = allLines.length * lineHeight;
        let startY = (dimensions.frontHeight - totalTextHeight) / 2 + (lineHeight / 2);

        // Ensure PDF export doesn't start off Canvas top
        if (startY < 5) startY = 5;

        allLines.forEach((line, i) => {
            ctx.fillText(line, dimensions.insideWidth / 2, startY + (i * lineHeight));
        });

        ctx.restore();
    } else if (config.livePreview) {
        // Only draw placeholder in live preview mode, not in the final PDF
        ctx.fillStyle = '#999';
        ctx.font = '3px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("Inside Panel", dimensions.backWidth + dimensions.spineWidth + dimensions.frontWidth + dimensions.insideWidth / 2, dimensions.frontHeight / 2);
    }
};
