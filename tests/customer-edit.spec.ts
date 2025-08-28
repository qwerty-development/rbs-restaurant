// tests/customer-edit.spec.ts
// Test specification for Customer Edit Functionality

import { test, expect } from '@playwright/test'

test.describe('Customer Edit Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test3@test.com with password test3
    await page.goto('http://localhost:3000/login')
    await page.getByRole('textbox', { name: 'Email' }).fill('test3@test.com')
    await page.getByRole('textbox', { name: 'Password' }).fill('test3')
    await page.getByRole('button', { name: 'Login' }).click()
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard')
    
    // Navigate to customers page
    await page.goto('http://localhost:3000/customers')
    await page.waitForLoadState('networkidle')
  })

  test('should display edit button for customers with manage permission', async ({ page }) => {
    // Look for customer named "charbel azzi"
    const customerRow = page.getByText('charbel azzi').locator('..').locator('..')
    
    // Verify edit button is visible
    const editButton = customerRow.getByRole('button').filter({ hasText: /edit/i })
    await expect(editButton).toBeVisible()
    
    // Click the edit button
    await editButton.click()
    
    // Verify edit dialog opens
    const editDialog = page.getByRole('dialog', { name: /edit customer/i })
    await expect(editDialog).toBeVisible()
    
    // Verify dialog title
    await expect(page.getByRole('heading', { name: 'Edit Customer' })).toBeVisible()
  })

  test('should edit guest customer information', async ({ page }) => {
    // Find a guest customer (one without user_id)
    const guestCustomerRow = page.getByText('Guest Customer').locator('..').locator('..')
    
    // Click edit button
    await guestCustomerRow.getByRole('button').filter({ hasText: /edit/i }).click()
    
    // Wait for dialog to open
    const editDialog = page.getByRole('dialog', { name: /edit customer/i })
    await expect(editDialog).toBeVisible()
    
    // Edit guest information
    await page.getByRole('textbox', { name: 'Guest Name' }).clear()
    await page.getByRole('textbox', { name: 'Guest Name' }).fill('Updated Guest Name')
    
    await page.getByRole('textbox', { name: 'Guest Email' }).clear()
    await page.getByRole('textbox', { name: 'Guest Email' }).fill('updated@email.com')
    
    await page.getByRole('textbox', { name: 'Guest Phone' }).clear()
    await page.getByRole('textbox', { name: 'Guest Phone' }).fill('+1234567890')
    
    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click()
    
    // Verify success message
    await expect(page.getByText('Customer updated successfully')).toBeVisible()
    
    // Verify dialog closes
    await expect(editDialog).not.toBeVisible()
  })

  test('should edit VIP status', async ({ page }) => {
    // Find customer "charbel azzi"
    const customerRow = page.getByText('charbel azzi').locator('..').locator('..')
    
    // Click edit button
    await customerRow.getByRole('button').filter({ hasText: /edit/i }).click()
    
    // Wait for dialog
    const editDialog = page.getByRole('dialog', { name: /edit customer/i })
    await expect(editDialog).toBeVisible()
    
    // Toggle VIP status
    const vipCheckbox = page.getByRole('checkbox', { name: /vip customer/i })
    const wasChecked = await vipCheckbox.isChecked()
    await vipCheckbox.click()
    
    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click()
    
    // Verify success message
    await expect(page.getByText('Customer updated successfully')).toBeVisible()
    
    // Verify VIP status changed in the customer list
    if (wasChecked) {
      await expect(customerRow.getByText('VIP')).not.toBeVisible()
    } else {
      await expect(customerRow.getByText('VIP')).toBeVisible()
    }
  })

  test('should edit blacklist status with reason', async ({ page }) => {
    // Find customer "charbel azzi"
    const customerRow = page.getByText('charbel azzi').locator('..').locator('..')
    
    // Click edit button
    await customerRow.getByRole('button').filter({ hasText: /edit/i }).click()
    
    // Wait for dialog
    const editDialog = page.getByRole('dialog', { name: /edit customer/i })
    await expect(editDialog).toBeVisible()
    
    // Toggle blacklist status
    const blacklistCheckbox = page.getByRole('checkbox', { name: /blacklisted/i })
    await blacklistCheckbox.click()
    
    // Enter blacklist reason
    const reasonTextarea = page.getByRole('textbox', { name: /blacklist reason/i })
    await expect(reasonTextarea).toBeVisible()
    await reasonTextarea.fill('Test reason for blacklisting')
    
    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click()
    
    // Verify success message
    await expect(page.getByText('Customer updated successfully')).toBeVisible()
    
    // Verify blacklist badge appears
    await expect(customerRow.getByText('Blacklisted')).toBeVisible()
  })

  test('should edit customer preferences', async ({ page }) => {
    // Find customer "charbel azzi"
    const customerRow = page.getByText('charbel azzi').locator('..').locator('..')
    
    // Click edit button
    await customerRow.getByRole('button').filter({ hasText: /edit/i }).click()
    
    // Wait for dialog
    const editDialog = page.getByRole('dialog', { name: /edit customer/i })
    await expect(editDialog).toBeVisible()
    
    // Select table type preferences
    await page.getByText('Booth').click()
    await page.getByText('Window').click()
    
    // Select time slot preferences
    await page.getByText('Dinner').click()
    await page.getByText('Late Night').click()
    
    // Save changes
    await page.getByRole('button', { name: 'Save Changes' }).click()
    
    // Verify success message
    await expect(page.getByText('Customer updated successfully')).toBeVisible()
  })

  test('should not allow editing registered user personal data', async ({ page }) => {
    // Find a registered user (one with user_id)
    const registeredUserRow = page.getByText('Registered User').locator('..').locator('..')
    
    // Click edit button
    await registeredUserRow.getByRole('button').filter({ hasText: /edit/i }).click()
    
    // Wait for dialog
    const editDialog = page.getByRole('dialog', { name: /edit customer/i })
    await expect(editDialog).toBeVisible()
    
    // Verify guest information fields are not present
    await expect(page.getByRole('textbox', { name: 'Guest Name' })).not.toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Guest Email' })).not.toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Guest Phone' })).not.toBeVisible()
    
    // Verify explanation text
    await expect(page.getByText('Personal information (name, email, phone) for registered users is managed in their profile')).toBeVisible()
    
    // Verify VIP and blacklist options are still available
    await expect(page.getByRole('checkbox', { name: /vip customer/i })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /blacklisted/i })).toBeVisible()
  })

  test('should show read-only calculated fields', async ({ page }) => {
    // Find customer "charbel azzi"
    const customerRow = page.getByText('charbel azzi').locator('..').locator('..')
    
    // Click edit button
    await customerRow.getByRole('button').filter({ hasText: /edit/i }).click()
    
    // Wait for dialog
    const editDialog = page.getByRole('dialog', { name: /edit customer/i })
    await expect(editDialog).toBeVisible()
    
    // Verify read-only section exists
    await expect(page.getByText('Read-Only Information')).toBeVisible()
    
    // Verify calculated fields are displayed
    await expect(page.getByText('Total Bookings:')).toBeVisible()
    await expect(page.getByText('Total Spent:')).toBeVisible()
    await expect(page.getByText('No Shows:')).toBeVisible()
    await expect(page.getByText('Cancelled:')).toBeVisible()
    
    // Verify explanation
    await expect(page.getByText('These values are automatically calculated and cannot be edited')).toBeVisible()
  })

  test('should validate form inputs', async ({ page }) => {
    // Find a guest customer
    const guestCustomerRow = page.getByText('Guest Customer').locator('..').locator('..')
    
    // Click edit button
    await guestCustomerRow.getByRole('button').filter({ hasText: /edit/i }).click()
    
    // Wait for dialog
    const editDialog = page.getByRole('dialog', { name: /edit customer/i })
    await expect(editDialog).toBeVisible()
    
    // Enter invalid email
    await page.getByRole('textbox', { name: 'Guest Email' }).clear()
    await page.getByRole('textbox', { name: 'Guest Email' }).fill('invalid-email')
    
    // Try to save
    await page.getByRole('button', { name: 'Save Changes' }).click()
    
    // Verify validation error
    await expect(page.getByText('Invalid email')).toBeVisible()
  })

  test('should close dialog on cancel', async ({ page }) => {
    // Find customer "charbel azzi"
    const customerRow = page.getByText('charbel azzi').locator('..').locator('..')
    
    // Click edit button
    await customerRow.getByRole('button').filter({ hasText: /edit/i }).click()
    
    // Wait for dialog
    const editDialog = page.getByRole('dialog', { name: /edit customer/i })
    await expect(editDialog).toBeVisible()
    
    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click()
    
    // Verify dialog closes
    await expect(editDialog).not.toBeVisible()
  })
})

// Expected Test Results for Customer "charbel azzi":
/*
BEFORE EDITING:
- Customer Name: charbel azzi
- Customer Type: Either Guest or Registered User
- VIP Status: Unknown (to be tested)
- Blacklist Status: Unknown (to be tested)
- Preferences: Unknown (to be tested)

AFTER EDITING (depending on test):
1. VIP Status Test: Toggle VIP status and verify badge appears/disappears
2. Blacklist Test: Add to blacklist with reason, verify "Blacklisted" badge
3. Preferences Test: Select booth/window table types and dinner/late-night time slots
4. Guest Data Test (if guest): Update name, email, phone
5. Registered User Test (if registered): Verify personal data cannot be edited

VALIDATION TESTS:
- Invalid email should show "Invalid email" error
- Blacklist without reason should require reason
- Form should prevent saving invalid data

PERMISSION TESTS:
- Edit button only visible with customers.manage permission
- Different field availability based on customer type
*/
