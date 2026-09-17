import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * One import for everything a scene needs to point at.
 *
 * Most of it is re-exported from the e2e suite's own helpers rather than
 * written again. Those helpers encode things about this grid that are easy to
 * get wrong and expensive to debug on film — that the canvas holds five weeks
 * at once so "the chip I can see" has to be scoped to the visible week, that a
 * minute-of-day becomes a pixel through the grid's own measured height rather
 * than an assumed one, that a scroll has to be read back because the browser
 * clamps it. A studio with its own second-best copy of all that would drift
 * from the suite and break in a different way.
 *
 * What is added here is the handful of surfaces the suite has no reason to
 * name: the rail's doors, a settings pane, a menu row by its text.
 */

export {
  DAY,
  GUTTER_PX,
  MINUTES_PER_DAY,
  allDayChip,
  allDayPoint,
  chip,
  editor,
  editorField,
  scrollTo,
  slotPoint,
  toaster,
  undoButton,
  visibleChips,
  visibleWeek,
} from '../e2e/support/calendar.ts';

export type Door = 'tasks' | 'schedule' | 'availability';

/** A door in the 48px rail. Opening one is a toggle — see ADR 0030. */
export function door(page: Page, which: Door): Locator {
  return page.getByTestId(`${which}-toggle`);
}

export function panel(page: Page): Locator {
  return page.locator('#side-panel');
}

/**
 * Opens the settings dialog and, optionally, one of its panes.
 *
 * Found by test id rather than by role and text, which is how the e2e suite
 * finds it and for a reason worth writing down. The dialog never renders the
 * word "Settings" anywhere a text filter can reach: its accessible name is
 * whichever pane is showing, so it answers to "General" on open, and the only
 * literal "Settings" in the markup is the tablist's `aria-label`, which is
 * not part of any element's `textContent`. Filtering on that word matches
 * nothing and then waits out the entire timeout while the dialog sits plainly
 * open on screen, which is a uniquely misleading way for a helper to fail.
 */
export async function openSettings(
  page: Page,
  pane?: string
): Promise<Locator> {
  await page.keyboard.press('Meta+Comma');
  const dialog = page.getByTestId('settings-dialog');
  await expect(dialog).toBeVisible();

  if (pane) {
    await dialog.getByRole('tab', { name: pane }).click();
  }

  return dialog;
}

/** A row in an open menu, by the text on it. */
export function menuRow(page: Page, label: string): Locator {
  return page.getByRole('menuitem', { name: label }).first();
}

export function commandRow(page: Page, label: string): Locator {
  return page.getByRole('option', { name: label }).first();
}
