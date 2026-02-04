# MiniDisc Cover Creator - Architecture Documentation

## Overview

The MiniDisc Cover Creator is a full-stack web application that generates print-ready J-card inserts for MiniDisc jewel cases. It integrates with MusicBrainz to fetch album metadata and cover art, provides an interactive canvas-based editor for customization, and exports PDFs with precise physical dimensions for printing.

## Technology Stack

### Frontend
- **Framework**: SolidJS (reactive UI framework)
- **Build Tool**: Vite
- **Canvas Rendering**: HTML5 Canvas API
- **PDF Generation**: jsPDF library
- **Styling**: Vanilla CSS with CSS custom properties for theming
- **Fonts**: Google Fonts (Anton for rear tab styling)

### Backend
- **Language**: Go (Golang)
- **HTTP Server**: Go standard library `net/http`
- **External APIs**: 
  - MusicBrainz API (album search and metadata)
  - Cover Art Archive (album cover images)

### Deployment
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: docker-compose
- **Port**: Backend runs on port 8081 (configurable via `PORT` env var)

## Project Structure

```
md-cover-creator/
├── cmd/
│   └── server/
│       └── main.go              # HTTP server entry point
├── internal/
│   └── musicbrainz/
│       └── client.go            # MusicBrainz API client
├── web/
│   ├── dist/                    # Built frontend (generated)
│   ├── src/
│   │   ├── App.jsx              # Main application component
│   │   ├── Editor.jsx           # J-card canvas editor
│   │   ├── index.css            # Global styles and theme
│   │   └── index.jsx            # SolidJS entry point
│   ├── index.html               # HTML template
│   ├── package.json             # Frontend dependencies
│   └── vite.config.js           # Vite configuration
├── Dockerfile                   # Multi-stage Docker build
├── docker-compose.yml           # Container orchestration
├── go.mod                       # Go module definition
├── README.md                    # User-facing documentation
├── TODO.MD                      # Feature roadmap
└── ARCHITECTURE.md              # This file
```

## Component Architecture

### Backend (`cmd/server/main.go`)

The Go backend is a simple HTTP server with three main responsibilities:

1. **Static File Serving**: Serves the built frontend from `./web/dist`
2. **API Endpoints**:
   - `GET /api/search?q=<query>` - Search MusicBrainz for releases
   - `GET /api/release/<id>` - Get detailed release metadata including tracklist
   - `GET /api/health` - Health check endpoint
3. **CORS Handling**: Implicitly handled by serving frontend and API from same origin

#### MusicBrainz Client (`internal/musicbrainz/client.go`)

The MusicBrainz client provides two main methods:

- **`SearchReleases(query string)`**: Searches for album releases
  - Returns: Array of release objects with `id`, `title`, `artist-credit`, `date`
  
- **`GetRelease(id string)`**: Fetches detailed release information
  - Includes: `artist-credits`, `recordings` (tracklist with durations)
  - **Critical**: Must include `"artist-credits"` in the `inc` parameter to populate artist names

### Frontend

#### App Component (`web/src/App.jsx`)

The main application component manages:

- **State Management**:
  - `query`: Search input text
  - `results`: Array of search results from MusicBrainz
  - `selectedRelease`: Currently selected album (full metadata)
  - `loading`: Search loading state
  - `theme`: Current theme ('dark' or 'light')

- **Key Functions**:
  - `search(e)`: Fetches search results from `/api/search`
  - `selectAlbum(release)`: Fetches full release details from `/api/release/<id>`
  - `toggleTheme()`: Switches between light/dark themes

- **Layout**:
  - **Sidebar**: Search interface and results list
  - **Main Area**: Editor component (when album selected)

#### Editor Component (`web/src/Editor.jsx`)

The core J-card editor with canvas-based rendering. This is the most complex component.

##### Dimensions System

All dimensions are in **millimeters** for print accuracy:

```javascript
const dimensions = () => ({
  frontWidth: 67.5,    // Front panel width
  frontHeight: 60,     // Front panel height
  spineWidth: 3,       // Spine width
  spineHeight: 60,     // Spine height
  backWidth: 3,        // Rear tab width
  backHeight: 60,      // Rear tab height
  insideWidth: 67.5,   // Inside panel width
  insideHeight: 60,    // Inside panel height
  bleed: 3             // Bleed area for printing
});
```

The canvas uses a **scale factor** to convert mm to pixels for display and PDF export.

##### State Management

- `coverImage`: HTMLImageElement for album cover
- `imageX`, `imageY`: Cover image position (in mm)
- `imageScale`: Cover image zoom level
- `isDragging`: Whether user is dragging the image
- `isResizing`: Whether user is resizing the image
- `resizeHandle`: Which resize handle is being dragged ('nw', 'ne', 'sw', 'se')
- `dragStart`: Starting coordinates for drag operations

##### Key Functions

###### `draw()`
Renders the J-card to the canvas for preview:

1. **Setup**: Clears canvas, applies scale factor
2. **Background**: Fills with white
3. **Front Panel** (left):
   - Draws cover image (if loaded) with user positioning/scaling
   - Draws resize handles (8x8mm squares at corners)
4. **Spine** (middle):
   - Draws artist and album title vertically (bottom-to-top, rotated 90°)
   - Font: 2.5mm sans-serif
5. **Rear Tab** (far left):
   - Draws artist name in uppercase
   - Font: Anton, dynamically sized to 90% of tab width
   - Orientation: Vertical (bottom-to-top, rotated 90°)
   - Position: Centered horizontally, 5mm from bottom
6. **Inside Panel** (right):
   - **Header**: Album title in bold (2mm font)
   - **Tracklist**: Track numbers, titles, and durations (1.8mm font)
7. **Guide Lines**:
   - Pink solid: Cut lines
   - Blue dashed: Fold lines
   - Grey dashed: Bleed lines

###### `exportPDF()`
Generates a print-ready PDF:

1. Creates jsPDF document in landscape A4 format
2. Renders identical content to `draw()` but at higher resolution
3. **Filename Format**: `[artist]-[album]-jcard.pdf`
   - Uses `safeName()` to sanitize (lowercase, replace special chars with underscores)
4. **Save Dialog**: Uses `window.showSaveFilePicker()` (with fallback to `doc.save()`)

###### Image Manipulation

- **`handleMouseDown(e)`**: Initiates drag or resize based on click location
- **`handleMouseMove(e)`**: Updates image position/scale during drag/resize
- **`handleMouseUp()`**: Ends drag/resize operation
- **`handleWheel(e)`**: Zooms image with mouse wheel

##### Canvas Coordinate System

- **Display Canvas**: Scaled for screen viewing (e.g., 2-3x for retina displays)
- **PDF Canvas**: Uses mm directly with jsPDF's coordinate system
- **Conversions**: All user interactions convert between screen pixels and mm

### Styling (`web/src/index.css`)

- **CSS Custom Properties**: Define colors for light/dark themes
- **Theme Switching**: `data-theme` attribute on `<html>` element
- **Glass Morphism**: Semi-transparent cards with backdrop blur
- **Responsive**: Flexbox-based layout

## Data Flow

### Album Search Flow

```
User Input → App.search() → GET /api/search?q=query 
  → MusicBrainz API → SearchReleases() 
  → Results displayed in sidebar
```

### Album Selection Flow

```
User Clicks Result → App.selectAlbum() → GET /api/release/<id>
  → MusicBrainz API (with artist-credits + recordings)
  → GetRelease() → Full metadata passed to Editor
  → Editor fetches cover image from Cover Art Archive
  → Canvas renders J-card preview
```

### PDF Export Flow

```
User Clicks "Export PDF" → Editor.exportPDF()
  → Create jsPDF document
  → Render all J-card elements to PDF canvas
  → Generate filename: safeName(artist)-safeName(album)-jcard.pdf
  → Show save dialog (or auto-download)
```

## Critical Implementation Details

### MusicBrainz API Integration

**IMPORTANT**: When fetching release details, you MUST include `"artist-credits"` in the `inc` parameter:

```go
q.Set("inc", "artist-credits+recordings")
```

Without this, the artist name will be `undefined` on the frontend.

### Font Loading

The **Anton** font is loaded via Google Fonts in `web/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&display=swap" rel="stylesheet">
```

Canvas rendering uses: `ctx.font = '${size}px "Anton", sans-serif'`

### Text Rotation for Spine and Rear Tab

Both spine and rear tab text are rotated 90° clockwise (bottom-to-top):

```javascript
ctx.save();
ctx.translate(x, y);
ctx.rotate(Math.PI / 2);  // 90° clockwise
ctx.fillText(text, 0, 0);
ctx.restore();
```

### Dynamic Font Sizing

The rear tab font size is calculated dynamically to fit the tab width:

```javascript
const antonSize = dimensions().backWidth * 0.9;  // 90% of tab width
```

This ensures text never overflows, even if dimensions change.

### PDF Filename Sanitization

The `safeName()` function ensures safe filenames:

```javascript
const safeName = (str) => str
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
  .replace(/\s+/g, '_')          // Spaces → underscores
  .replace(/-+/g, '-');          // Collapse multiple hyphens
```

Example: `"Radiohead - In Rainbows"` → `"radiohead-in_rainbows"`

## Development Workflow

### Running Locally

1. **Backend** (Terminal 1):
   ```bash
   cd /Users/chrisconnolly/git/personal/md-cover-creator
   PORT=8081 go run cmd/server/main.go
   ```

2. **Frontend** (Terminal 2):
   ```bash
   cd web
   npm install
   npm run dev
   ```

3. **Access**: Frontend dev server (usually `http://localhost:5173`) proxies API requests to backend

### Building for Production

```bash
# Build frontend
cd web
npm run build

# Build and run with Docker
docker-compose up --build
```

### Git Workflow

**Note**: GPG signing is disabled for this project:
```bash
git commit --no-gpg-sign -m "message"
```

## Physical Specifications

### J-Card Dimensions (mm)

- **Front Panel**: 67.5 × 60 mm
- **Spine**: 3 × 60 mm
- **Rear Tab**: 3 × 60 mm
- **Inside Panel**: 67.5 × 60 mm
- **Bleed**: 3 mm on all sides

### Total Unfolded Size

Width: 67.5 (front) + 3 (spine) + 3 (rear) + 67.5 (inside) = **141 mm**
Height: **60 mm**

### Printing Notes

- **Resolution**: 300 DPI recommended
- **Color Space**: RGB (for digital printing)
- **Cut Lines**: Pink solid lines indicate where to cut
- **Fold Lines**: Blue dashed lines indicate where to fold
- **Bleed Lines**: Grey dashed lines show bleed area (extend artwork here)

## Common Modification Patterns

### Adding a New Feature to the Editor

1. Add state signal in `Editor.jsx`: `const [newFeature, setNewFeature] = createSignal(defaultValue);`
2. Update `draw()` function to render the feature on canvas
3. Update `exportPDF()` function to include feature in PDF export
4. Add UI controls in the JSX return statement
5. Test both canvas preview and PDF export

### Changing J-Card Dimensions

1. Update `dimensions()` function in `Editor.jsx`
2. Verify all rendering logic still works (especially text positioning)
3. Update this documentation with new specs

### Adding a New API Endpoint

1. Add handler in `cmd/server/main.go`
2. If needed, add method to `internal/musicbrainz/client.go`
3. Update frontend to call new endpoint

### Styling Changes

1. Modify CSS custom properties in `web/src/index.css` for theme changes
2. Update component-specific styles in JSX `style` attributes
3. Test both light and dark themes

## Known Issues and Gotchas

### Browser Compatibility

- **`window.showSaveFilePicker()`**: Only works in Chromium browsers (Chrome, Edge, Opera)
  - Fallback: `doc.save()` auto-downloads in other browsers
  
### Canvas Text Rendering

- **Font Loading**: Anton font must be loaded before canvas rendering
  - If text appears in fallback font, check Google Fonts link in `index.html`
  
### Image Manipulation

- **Bounding Box**: Currently always visible (TODO: hide when no image selected)
- **Resize Handles**: Fixed 8mm size (may be too large/small on different displays)

### MusicBrainz API

- **Rate Limiting**: MusicBrainz has rate limits (1 request/second recommended)
- **Missing Data**: Some releases may not have cover art or complete metadata
- **Artist Credits**: Always include in API requests to avoid `undefined` artist names

## Future Enhancements (from TODO.MD)

1. **Image Upload**: Allow users to upload custom cover art from local files
2. **Manual Text Input**: Add textboxes for manually entering artist/title (bypass MusicBrainz)
3. **Conditional Bounding Box**: Show resize handles only when image is selected
4. **Local Storage**: Save user progress in browser localStorage
5. **Color Pickers**: 
   - Background color selector
   - Text color selector

## Testing Checklist

When making changes, verify:

- [ ] Canvas preview renders correctly
- [ ] PDF export matches canvas preview
- [ ] PDF filename follows `[artist]-[album]-jcard.pdf` format
- [ ] Spine text reads bottom-to-top (rotated 90° clockwise)
- [ ] Rear tab text is in Anton font, uppercase, bottom-to-top
- [ ] Rear tab font size fits within tab width
- [ ] Tracklist shows album title as header (not "Tracks:")
- [ ] Image manipulation (drag/resize) works smoothly
- [ ] Both light and dark themes work
- [ ] MusicBrainz search returns results
- [ ] Album selection loads full metadata and cover art

## Debugging Tips

### Artist Name Shows "undefined"

- Check `internal/musicbrainz/client.go` includes `"artist-credits"` in `inc` parameter
- Verify API response in browser DevTools Network tab

### Cover Image Not Loading

- Check Cover Art Archive URL in DevTools Network tab
- Some releases may not have cover art (404 is normal)
- Verify CORS is not blocking the request

### PDF Export Issues

- Check browser console for jsPDF errors
- Verify all fonts are loaded before export
- Test save dialog in Chromium-based browser

### Canvas Rendering Issues

- Check scale factor calculations
- Verify coordinate transformations (mm ↔ pixels)
- Use `ctx.save()` and `ctx.restore()` to isolate transformations

## Contact and Contribution

This project is maintained as a personal tool. For questions or contributions, refer to the main README.md.
