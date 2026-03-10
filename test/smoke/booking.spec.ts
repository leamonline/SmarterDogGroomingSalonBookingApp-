import { expect, test, type Page } from '@playwright/test';

const services = [
  {
    id: 'svc-empty',
    name: 'Tidy Up',
    description: 'Short refresh groom',
    duration: 60,
    price: 35,
    category: 'Bath',
  },
  {
    id: 'svc-reset',
    name: 'Full Groom',
    description: 'Longer full groom',
    duration: 90,
    price: 72,
    category: 'Grooming',
  },
  {
    id: 'svc-first',
    name: 'Puppy Intro',
    description: 'Gentle first groom',
    duration: 30,
    price: 28,
    category: 'Puppy',
  },
];

const schedule = [
  { day: 'Monday', isClosed: false, slots: [{ time: '08:30', isAvailable: true }] },
  { day: 'Tuesday', isClosed: false, slots: [{ time: '08:30', isAvailable: true }] },
  { day: 'Wednesday', isClosed: false, slots: [{ time: '08:30', isAvailable: true }] },
  { day: 'Thursday', isClosed: false, slots: [{ time: '08:30', isAvailable: true }] },
  { day: 'Friday', isClosed: false, slots: [{ time: '08:30', isAvailable: true }] },
  { day: 'Saturday', isClosed: false, slots: [{ time: '08:30', isAvailable: true }] },
  { day: 'Sunday', isClosed: true, slots: [] },
];

type SlotResolver = (request: { date: string; duration: number }) => string[];

const formatDateKey = (daysAhead: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysAhead);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildSlot = (daysAhead: number, hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

async function stubBookingApi(page: Page, resolveSlots: SlotResolver) {
  await page.route('**/api/public/services', async (route) => {
    await route.fulfill({ json: services });
  });

  await page.route('**/api/public/schedule', async (route) => {
    await route.fulfill({ json: schedule });
  });

  await page.route('**/api/public/available-slots**', async (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get('date') ?? '';
    const duration = Number(url.searchParams.get('duration') ?? '60');

    await route.fulfill({
      json: {
        slots: resolveSlots({ date, duration }),
        date,
        duration,
      },
    });
  });
}

async function openAuthedBookingPage(page: Page, resolveSlots: SlotResolver) {
  await page.addInitScript(() => {
    localStorage.setItem('petspa_booking_token', 'smoke-token');
    localStorage.setItem('petspa_booking_email', 'smoke@example.com');
    localStorage.setItem('petspa_booking_customer_id', 'customer-smoke');
  });

  await stubBookingApi(page, resolveSlots);
  await page.goto('/book');
}

test('shows the single-day no-slots state without the two-week warning', async ({ page }) => {
  await openAuthedBookingPage(page, () => []);

  await page.getByRole('button', { name: /Tidy Up/ }).click();

  await expect(page.getByTestId('booking-no-slots-card')).toBeVisible();
  await expect(page.getByTestId('booking-no-availability-banner')).toHaveCount(0);
});

test('shows the two-week warning after find first available fails', async ({ page }) => {
  await openAuthedBookingPage(page, () => []);

  await page.getByRole('button', { name: /Tidy Up/ }).click();
  await page.getByRole('button', { name: 'Find first available' }).click();

  await expect(page.getByTestId('booking-no-availability-banner')).toBeVisible();
});

test('clears the two-week warning when the customer changes service', async ({ page }) => {
  await openAuthedBookingPage(page, ({ duration }) => {
    if (duration === 60) return [];
    if (duration === 90) return [];
    return [];
  });

  await page.getByRole('button', { name: /Tidy Up/ }).click();
  await page.getByRole('button', { name: 'Find first available' }).click();
  await expect(page.getByTestId('booking-no-availability-banner')).toBeVisible();

  await page.getByRole('button', { name: /Back/ }).click();
  await page.getByRole('button', { name: /Full Groom/ }).click();

  await expect(page.getByTestId('booking-no-slots-card')).toBeVisible();
  await expect(page.getByTestId('booking-no-availability-banner')).toHaveCount(0);
});

test('selects the earliest later slot and keeps the two-week warning hidden', async ({ page }) => {
  await openAuthedBookingPage(page, ({ date, duration }) => {
    if (duration !== 30) return [];
    if (date === formatDateKey(3)) {
      return [buildSlot(3, 10, 30)];
    }
    return [];
  });

  await page.getByRole('button', { name: /Puppy Intro/ }).click();
  await page.getByRole('button', { name: 'Find first available' }).click();

  const selectedSlotSummary = page.getByTestId('booking-selected-slot-summary');
  await expect(selectedSlotSummary).toBeVisible();
  await expect(selectedSlotSummary.getByText(/10:30/i)).toBeVisible();
  await expect(page.getByTestId('booking-no-availability-banner')).toHaveCount(0);
});
