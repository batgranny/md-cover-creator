# UI Automation Tests

This directory contains the automated end-to-end (E2E) UI test suite for the **MiniDisc J-Card Creator**.

## Software Used

These tests are built using **[Playwright](https://playwright.dev/)**, an open-source automation framework from Microsoft. 

Playwright explicitly controls a real browser engine (we are currently using headless Chromium) to click elements, type text, capture downloads, and verify the UI state behaves precisely as a real user would experience it.

## Tests Performed

The current suite (`ui.spec.js`) verifies the core critical paths of the application:

1. **Initial Load**: Verifies the application boots successfully and displays the correct layout and typography.
2. **Manual Entry & PDF Generation**: 
    - Verifies clicking "Start from Scratch" initializes the editor canvas.
    - Simulates human typing into the Artist and Album input fields.
    - Validates that clicking "Download PDF" intercepts and generates a file with the correct naming convention (`[artist]-[album]-jcard.pdf`).
3. **MusicBrainz Search Integration**: 
    - Types into the search input fields and clicks "Go".
    - Waits for the asynchronous API call to return results.
    - Clicks a search result and verifies the application correctly transitions to the loaded canvas view with populated data.
4. **Theming**: Toggles the dark/light mode button and asserts that the `data-theme` attribute correctly switches on the document `<html>` tag.

## How to Run the Tests Locally

Because Playwright acts as a human interacting with the website, your backend Go server **must be running** first.

### Step 1: Start the Backend Server (Terminal 1)
From the root of the project directory, run:
```bash
export PORT=8081 && go run cmd/server/main.go
```

### Step 2: Run the Playwright Suite (Terminal 2)
In a separate terminal window, navigate into the frontend `web/` directory and run the NPM test script:
```bash
cd web
npm run test:e2e
```

### Advanced Test Commands

* **Watch the Browser (Headed Mode)**: By default, tests run invisibly to be incredibly fast. If you want to visually watch the browser perform the clicks:
  ```bash
  npx playwright test --headed
  ```
* **View the Test Report**: If a test fails and you want to see exactly which step broke (including trace logs):
  ```bash
  npx playwright show-report
  ```
