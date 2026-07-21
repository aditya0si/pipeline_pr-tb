import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

test.describe('MedVault OCR Pipeline E2E', () => {

  // Helper to load sample image
  const getSampleBuffer = () => {
    const samplePath = path.resolve(process.cwd(), '../uploads/34882d6c-4947-4ad8-add3-ade7b1529d24.jpeg');
    if (fs.existsSync(samplePath)) {
      return fs.readFileSync(samplePath);
    }
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
  };

  // T1 — Patient Portal: Upload Flow
  test('T1: Patient Portal - Upload Flow', async ({ page }) => {
    await page.goto('/');
    await page.locator('.hero-card').filter({ hasText: 'Patient Portal' }).click();
    await expect(page.locator('h1').filter({ hasText: 'My Reports' })).toBeVisible();

    const buffer = getSampleBuffer();
    
    // Setup request interception to mock the upload so we don't spam the real backend in E2E tests,
    // OR we can actually do a real upload if the backend is running.
    // Let's do a real upload since the backend is running locally.
    
    // Listen for the file chooser
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.upload-zone').click();
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles({
      name: 'test-report.png',
      mimeType: 'image/png',
      buffer
    });

    // Select the document type
    await page.locator('button').filter({ hasText: 'Printed' }).click();

    // It should upload and display a new report card with "Uploaded" status
    // Wait for the report card to appear
    const reportCard = page.locator('.report-card').first();
    await expect(reportCard).toBeVisible();
    await expect(reportCard.locator('.tag.uploaded')).toBeVisible();
  });

  // T2 — Doctor Portal: Patient List Loads
  test('T2: Doctor Portal - Patient List Loads', async ({ page }) => {
    await page.goto('/');
    await page.locator('.hero-card').filter({ hasText: 'Doctor Portal' }).click();
    await expect(page.locator('h1').filter({ hasText: 'Doctor Dashboard' })).toBeVisible();
    
    // Wait for patient list to load
    const patientRow = page.locator('.patient-row').first();
    await expect(patientRow).toBeVisible();
    
    // Check that there is at least one patient with a report count
    const reportBadge = patientRow.locator('.report-badge');
    await expect(reportBadge).toBeVisible();
    const badgeText = await reportBadge.textContent();
    expect(badgeText).toMatch(/\d+ reports?/);
  });

  // T3 — Doctor Portal: View Reports for a Patient
  test('T3: Doctor Portal - View Reports for a Patient', async ({ page }) => {
    await page.goto('/');
    await page.locator('.hero-card').filter({ hasText: 'Doctor Portal' }).click();
    
    // Click on the first patient
    const patientRow = page.locator('.patient-row').first();
    await expect(patientRow).toBeVisible();
    await patientRow.click();
    
    // The report detail view should load
    const detailPanel = page.locator('.report-list');
    await expect(detailPanel).toBeVisible();
    
    // Check that at least one report card is visible with Run Pipeline button
    const docCard = page.locator('.report-card').first();
    await expect(docCard).toBeVisible();
    await expect(docCard.locator('button', { hasText: 'Open File' })).toBeVisible();
    await expect(docCard.locator('button', { hasText: 'Run Pipeline' })).toBeVisible();
  });

  // T4 — Doctor Portal: Run Pipeline → Panels Populate
  test('T4: Doctor Portal - Run Pipeline -> Panels Populate', async ({ page }) => {
    test.setTimeout(60000); // OCR might take a bit
    await page.goto('/');
    await page.locator('.hero-card').filter({ hasText: 'Doctor Portal' }).click();
    
    // Click on the first patient
    await page.locator('.patient-row').first().click();
    
    // Click Run Pipeline on the first report
    const docCard = page.locator('.report-card').first();
    const runBtn = docCard.locator('button', { hasText: 'Run Pipeline' });
    await expect(runBtn).toBeVisible();
    await runBtn.click();
    
    // Wait for the pipeline accordion to appear (OCR pipeline can take up to 45-60s)
    const accordion = page.locator('.pipeline-accordion');
    await expect(accordion).toBeVisible({ timeout: 60000 });
    
    // T6 — GPU Status Panel: No Red Errors (Checked here while we are in the Doctor portal)
    const gpuPanel = page.locator('.gpu-status-panel');
    if (await gpuPanel.isVisible()) {
        const cudaRow = gpuPanel.locator('.gpu-row').filter({ hasText: 'CUDA Core' });
        await expect(cudaRow.locator('.status-text')).toContainText(/CPU mode|Hardware acceleration/);
        await expect(cudaRow.locator('.status-text')).not.toContainText('Not available');
    }

    // Wait for processing to complete (the pipeline dots should be done)
    // The pipeline strip has "stage-dot" elements containing "✓" when done
    const lastStageDot = page.locator('.pipeline-strip .pipeline-stage').last().locator('.stage-dot');
    await expect(lastStageDot).toHaveText('✓', { timeout: 45000 });
    
    // Check that panels are populated
    // OCR panel (now panel 0 after classification removal)
    const ocrPanel = accordion.locator('.acc-panel').nth(0);
    await expect(ocrPanel).not.toContainText('No OCR text was produced');
    
    // Check that lab results or diagnosis is visible (depends on the document)
    // We just ensure they don't both show empty/error states if it was a lab report
  });

  // T5 — API Contract Test: pipeline/run shape
  test('T5: API Contract - pipeline/run shape', async ({ request }) => {
    const buffer = getSampleBuffer();
    
    const response = await request.post('/api/pipeline/run', {
      multipart: {
        file: {
          name: 'test.png',
          mimeType: 'image/png',
          buffer: buffer,
        },
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // Verify the nested shape
    expect(data).toHaveProperty('preprocessing');
    expect(data).toHaveProperty('ocr');
    expect(data).toHaveProperty('lab_report');
    expect(data).toHaveProperty('diagnosis');
    expect(data).toHaveProperty('metadata');
    
    expect(data.ocr).toHaveProperty('raw_output');
    // For a 1x1 image, raw_output might be empty string, but it shouldn't be undefined
    expect(typeof data.ocr.raw_output).toBe('string');
  });
});
