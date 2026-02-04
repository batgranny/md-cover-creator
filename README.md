# MiniDisc Cover Creator

A web-based tool for designing and printing high-quality J-cards for MiniDisc cases. Integrated with MusicBrainz for automatic metadata and cover art retrieval.

## Features

- **MusicBrainz Integration**: Search for any album to automatically fetch high-resolution cover art and tracklists.
- **Interactive Editor**:
  - **Move & Scale**: Drag and zoom the cover art to position it perfectly.
  - **Resize Handles**: Use bounding box handles to resize the artwork while maintaining aspect ratio.
  - **Configurable Dimensions**: Customize the width of the Front, Spine, Rear Tab, and Inside Panel layout (defaults to standard J-card size).
- **Inside Panel Support**: Automatically generates a tracklist on the inside fold-out panel using data from MusicBrainz.
- **PDF Export**: Generates print-ready A4 PDFs with:
  - High-resolution graphics (300 DPI equivalent scaling)
  - Precise cut lines (solid red)
  - Fold lines (dashed blue)
  - Crop marks for professional trimming
- **Theme Support**: Includes a VS Code-inspired Dark Mode (default) and Light Mode.

## Tech Stack

- **Frontend**: SolidJS + Vite
- **Backend**: Go (Golang)
- **Styling**: Vanilla CSS (CSS Variables)
- **PDF Generation**: jsPDF

## Getting Started

### Prerequisites

- [Go](https://go.dev/) (1.18+)
- [Node.js](https://nodejs.org/) (16+)

### Running Locally

1.  **Start the Backend Server**
    ```bash
    # From project root
    export PORT=8081
    go run cmd/server/main.go
    ```
    The server will start on `http://localhost:8081` (proxies requests to MusicBrainz).

2.  **Start the Frontend Client**
    ```bash
    # Open a new terminal
    cd web
    npm install
    npm run dev
    ```
    The frontend will start on `http://localhost:3000`.

### Building for Production

1.  **Build Frontend**
    ```bash
    cd web
    npm run build
    ```
2.  **Run Server**
    The Go server is configured to serve static files from `web/dist` if present.
    ```bash
    go run cmd/server/main.go
    ```

## Docker

A `Dockerfile` and `docker-compose.yml` are provided for containerized deployment.

```bash
docker-compose up --build
```

## License

MIT