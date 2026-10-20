/**
 * The run screen.
 *
 * The two things that used to be broken:
 *  - the event dialog was rebuilt every frame, so the click of the player was
 *    swallowed and the dialog vanished after three seconds,
 *  - the choice of the room was the only decision of a run and the tree was
 *    hard to read.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { Content } from '../src/data/registry';
import { Game } from '../src/game';

async function renderRun(game: Game): Promise<HTMLElement> {
  const content = document.createElement('div');
  const { renderRunScreen } = await import('../src/ui/run');
  renderRunScreen(content, game);
  return content;
}

describe('the run screen', () => {
  it('lets the player pick a path and keeps the choice', async () => {
    const game = new Game();
    game.init();
    game.startRun(1);
    const state = game.state!;
    expect(state.routeId).toBeNull();

    const content = await renderRun(game);
    const rooms = content.querySelectorAll('g.tree-node--clickable');
    expect(rooms.length).toBeGreaterThan(0);

    // Every path of the pit can be picked.
    const names = new Set(
      [...rooms].map((room) => (room.getAttribute('aria-label') ?? '').split(',')[0] ?? ''),
    );
    expect(names.size).toBe(state.routes.routes.length);

    const first = state.routes.routes[0]!;
    (rooms[0] as SVGGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(state.routeId).toBe(first.id);
    // The path cannot be changed afterwards.
    game.pickRoute(state.routes.routes[1]!.id);
    expect(state.routeId).toBe(first.id);
  });

  it('keeps the event dialog open and lets the player choose', async () => {
    const game = new Game();
    game.init();
    game.startRun(1);
    const state = game.state!;
    const event = [...Content.events.values()][0]!;
    const room = state.routes.routes[0]!.nodes[0]!;

    state.phase = 'event';
    state.pendingEvent = { nodeId: room.id, eventId: event.id };
    const content = await renderRun(game);

    const modal = content.querySelector('.modal--event');
    expect(modal).toBeTruthy();
    const choices = modal!.querySelectorAll('.modal__choice');
    expect(choices.length).toBe(event.choices.length);
    // The dialog tells the player how long it stays open.
    expect(modal!.querySelector('.modal__timer')?.textContent).toBeTruthy();

    // The dialog is not rebuilt every frame - the click still works.
    game.onRender?.();
    game.onRender?.();
    const modalAgain = content.querySelector('.modal--event');
    expect(modalAgain).toBe(modal);

    (choices[0] as HTMLButtonElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(state.phase).not.toBe('event');
    expect(content.querySelector('.modal--event')).toBeFalsy();
  });
});
