import { test, expect } from '@playwright/test';

test.describe('MiniDisc J-Card Creator UI', () => {

    test('should load the application and have correct title', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 1, name: 'MiniDisc J-Card Creator' })).toBeVisible();
    });

    test('should perform manual entry and download PDF', async ({ page }) => {
        await page.goto('/');

        // Start from scratch
        await page.getByRole('button', { name: 'Start from Scratch' }).click();

        // Canvas should exist
        const canvas = page.locator('.canvas-wrapper canvas');
        await expect(canvas).toBeVisible();

        // Fill out artist and title
        const artistInput = page.getByPlaceholder('Artist Name');
        await expect(artistInput).toBeVisible();
        await artistInput.fill('Playwright Artist');

        const titleInput = page.getByPlaceholder('Album Title');
        await expect(titleInput).toBeVisible();
        await titleInput.fill('Playwright Album');

        // Trigger PDF download and catch the download event
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download PDF' }).click();
        const download = await downloadPromise;

        // Verify it generated the correct filename
        expect(download.suggestedFilename()).toBe('playwright_artist-playwright_album-jcard.pdf');
    });

    test('should perform MusicBrainz search', async ({ page }) => {
        await page.goto('/');

        // Type into the search fields
        await page.getByPlaceholder('Album...').fill('Earthling');
        await page.getByPlaceholder('Artist (Optional)...').fill('David Bowie');

        // Click Search Go button
        await page.getByRole('button', { name: 'Go' }).click();

        // Wait for Search results to populate
        const searchResult = page.locator('.search-result').first();
        await expect(searchResult).toBeVisible({ timeout: 10000 });

        // Click the result
        await searchResult.click();

        // Canvas should appear with populated data
        const canvas = page.locator('.canvas-wrapper canvas');
        await expect(canvas).toBeVisible();
    });

    test('should toggle light/dark theme', async ({ page }) => {
        await page.goto('/');

        // Default should be dark theme based on index.css
        // The html data-theme attribute is added when toggled
        const themeBtn = page.locator('.theme-toggle');
        await expect(themeBtn).toBeVisible();

        await themeBtn.click(); // Should toggle to light
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

        await themeBtn.click(); // Should toggle to dark
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    });
});
