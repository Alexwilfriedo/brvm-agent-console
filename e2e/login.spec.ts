import { test, expect } from '@playwright/test'

test.describe('E2E-4 — Login flow (magic link + admin token)', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('h1')).toContainText(/(Connexion|Login|BRVM)/i)
  })

  test('admin token tab accepts a valid token and lands on dashboard', async ({ page }) => {
    await page.goto('/login')

    await page.getByRole('tab', { name: /token admin/i }).click()

    const token = process.env.E2E_ADMIN_TOKEN
    test.skip(!token, 'E2E_ADMIN_TOKEN non défini')

    await page.getByLabel(/token/i).fill(token!)
    await page.getByRole('button', { name: /se connecter|valider/i }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByText(/tableau de bord/i)).toBeVisible()
  })

  test('admin token tab rejects invalid token', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('tab', { name: /token admin/i }).click()
    await page.getByLabel(/token/i).fill('invalid-token-xxxxxxxxxxxxxxxxxxxx')
    await page.getByRole('button', { name: /se connecter|valider/i }).click()

    await expect(page.getByText(/token refusé|invalide/i)).toBeVisible()
  })

  test('magic link tab sends email request', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('tab', { name: /magic link|email/i }).click()
    await page.getByLabel(/email/i).fill('test@example.ci')
    await page.getByRole('button', { name: /envoyer|recevoir/i }).click()

    await expect(page.getByText(/lien envoyé|vérifiez votre boîte/i)).toBeVisible()
  })
})
