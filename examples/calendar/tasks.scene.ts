import { scene } from 'video-demo/scene';
import { door } from '../ui.ts';

/**
 * The order here is the point, and it is the opposite of the first attempt.
 *
 * A scene used to narrate a thing and then go and do it, because the rule was
 * that a zoom may only wrap a spoken line and narration must not move. That
 * produced a demo which talked about Today while the Inbox was on screen, and
 * pushed in silently a beat later on a list nobody had been told about. Both
 * halves were wrong for the same reason.
 *
 * So: do the thing, then talk about what is now on screen while the picture is
 * pushed in on it. That is how somebody recording their own screen does it,
 * and it means the voice, the zoom and the subject are the same moment rather
 * than three moments in a row.
 */
scene(
  'tasks',
  {
    title: 'Your to-dos, next to your calendar',
    blurb:
      'An inbox for anything undated, Today for what you planned, and the rest grouped by day.',
    ref: '0016',
  },
  async ({ actor, page, shot }) => {
    const panelBody = () => page.getByTestId('tasks-panel-body');
    const row = (title: string) =>
      panelBody().getByTestId('task-row').filter({ hasText: title });
    const view = (label: 'Inbox' | 'Today' | 'Upcoming') =>
      page.getByRole('radio', { name: label });

    await actor.click(door(page, 'tasks'));
    await actor.settle();

    // "next to the calendar" only reads if the calendar is still in frame, so
    // this beat points rather than pushes in.
    await actor.hover(panelBody(), 200);
    await actor.say(
      'So your tasks sit right here, next to the calendar. Not in a separate app.'
    );
    await shot('inbox');

    await actor.click(view('Today'));
    await actor.settle();

    /**
     * Two sentences, two beats, because the pointer moves on the first word.
     *
     * As one line this said "Today is what you planned for today" while the
     * cursor was already travelling to a specific row, so it arrived a second
     * and a half before the words that were about it. One subject per line is
     * the rule that falls out of pointing at things: if a line has two
     * subjects, it is two lines.
     */
    await actor.say('Today is what you planned for today.');
    await actor.spotlight(
      row('Send Sam the hiring loop feedback'),
      'And this one is from yesterday that I never got to, so it is flagged.',
      { scale: 1.8, stay: true }
    );
    await shot('overdue');
    await actor.unfocus();

    await actor.click(view('Upcoming'));
    await actor.settle();

    // The rows, not the panel: the panel is a full-height flex box, so with a
    // short list its centre is the empty space underneath and a zoom on it
    // frames nothing.
    await actor.spotlight(
      panelBody().getByTestId('task-row').first(),
      'Upcoming just groups everything else by the day it is due.',
      { scale: 1.5, stay: true }
    );
    await shot('upcoming');
    await actor.unfocus();

    await actor.click(view('Today'));
    await actor.settle();

    // Zoomed for the line, the click and the result, so the tick is watchable.
    await actor.focus(row('Approve the invoice'), { scale: 1.9 });
    await actor.say('Tick one off and it is gone.');
    await actor.click(row('Approve the invoice').getByRole('checkbox'));
    await actor.beat(700);
    await shot('done');
    await actor.unfocus();

    await actor.click(row('Draft the Q4 brief'));
    await page.getByTestId('task-dialog').waitFor({ state: 'visible' });
    await actor.settle();
    await actor.spotlight(
      page.getByTestId('task-dialog'),
      'And if a task needs notes, or a rough idea of how long it will take, that is all in here.',
      { scale: 1.45, stay: true }
    );
    await shot('dialog');
    await actor.unfocus();
  }
);
