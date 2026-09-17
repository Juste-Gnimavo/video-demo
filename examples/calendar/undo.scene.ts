import { scene } from 'video-demo/scene';
import { chip, scrollTo, toaster, undoButton } from '../ui.ts';

scene(
  'undo',
  {
    title: 'Every change is one keystroke from gone',
    blurb:
      'Delete anything and the toast holds an undo for as long as it stands.',
    ref: '0008',
  },
  async ({ actor, page, shot }) => {
    await scrollTo(page, 15 * 60);
    await actor.say('Delete anything', 900);
    await actor.hover(chip(page, 'Board prep'), 700);
    await actor.click(chip(page, 'Board prep'));
    await actor.beat(400);

    await actor.say('The toast holds an undo for as long as it stands', 200);
    await actor.press('Backspace');
    await toaster(page)
      .getByText('Event deleted')
      .waitFor({ state: 'visible' });
    await shot('toast');

    /**
     * Straight to the keystroke, and narrated afterwards.
     *
     * `UNDO_WINDOW_MS` is six seconds (`packages/core/src/lib/undo.ts`), and
     * everything a scene would naturally do here — push in on the toast, take
     * a still, read a line about it — spends them. This scene did all three
     * and pressed the keys into a window that had already closed, which looks
     * from the outside exactly like Undo being broken: no error, no toast, the
     * chip simply never comes back. So the gesture goes inside the window and
     * the words come after it, over the chip already restored.
     */
    await actor.press('Meta+z');
    await chip(page, 'Board prep').waitFor({ state: 'visible' });
    await undoButton(page).waitFor({ state: 'hidden' });

    await actor.spotlight(chip(page, 'Board prep'), 'and it comes straight back', {
      scale: 1.8,
    });
    await actor.beat(600);
    await shot('restored');
    await actor.unfocus();
    await actor.say(null);
  }
);
