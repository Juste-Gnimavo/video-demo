import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Page } from '@playwright/test';

/**
 * A real streaming server, for the one route where a buffered answer is a lie.
 *
 * Everything else the studio answers goes through `route.fulfill`, which hands
 * the page a complete body in one go. For the assistant that is not a
 * simplification, it is a different product: the whole texture of talking to a
 * model is that the answer arrives a few words at a time, and a card that
 * simply blinks into existence fully formed demonstrates something the app
 * does not do. Playwright cannot fulfill a stream, so this stands up an
 * ordinary HTTP server, writes the same UI-message-stream events the API
 * writes, and sleeps between them.
 *
 * The page never learns it is talking to another port. `route.continue` may
 * rewrite a request's URL, and because the rewrite happens below the browser
 * the response arrives attributed to the address the app asked for: same
 * origin as far as the page is concerned, no preflight, no CORS, and no
 * special case anywhere in the app. The one constraint is that the protocol
 * cannot change, which is why this is plain `http` and not `https`.
 */

export type Turn = {
  /** Tool calls the card is built from, before any prose. */
  parts?: unknown[];
  /** Said a few words at a time, the way the model says it. */
  text: string;
  /** Milliseconds between chunks. */
  pace?: number;
};

const CHUNK_WORDS = 3;

function sse(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function chunks(text: string): string[] {
  const words = text.split(' ');
  const out: string[] = [];

  for (let at = 0; at < words.length; at += CHUNK_WORDS) {
    const slice = words.slice(at, at + CHUNK_WORDS).join(' ');
    out.push(at === 0 ? slice : ` ${slice}`);
  }

  return out;
}

export class StreamServer {
  private server: Server | null = null;
  private turns: Turn[] = [];
  private served = 0;

  /** Each request takes the next turn, so a scene can script a conversation. */
  answerWith(turns: Turn[]): void {
    this.turns = turns;
    this.served = 0;
  }

  async listen(): Promise<number> {
    const server = createServer((_request, response) => {
      const turn = this.turns[Math.min(this.served, this.turns.length - 1)];
      this.served += 1;

      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'x-vercel-ai-ui-message-stream': 'v1',
      });

      if (!turn) {
        response.end('data: [DONE]\n\n');
        return;
      }

      void this.write(response, turn);
    });

    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    this.server = server;

    return (server.address() as AddressInfo).port;
  }

  private async write(
    response: { write(chunk: string): void; end(chunk?: string): void },
    turn: Turn
  ): Promise<void> {
    const pace = turn.pace ?? 55;
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    response.write(sse({ type: 'start', messageId: `demo-${this.served}` }));
    response.write(sse({ type: 'start-step' }));

    for (const part of turn.parts ?? []) {
      response.write(sse(part));
      await sleep(180);
    }

    response.write(sse({ type: 'text-start', id: 't' }));
    for (const chunk of chunks(turn.text)) {
      response.write(sse({ type: 'text-delta', id: 't', delta: chunk }));
      await sleep(pace);
    }
    response.write(sse({ type: 'text-end', id: 't' }));

    response.write(sse({ type: 'finish-step' }));
    response.write(sse({ type: 'finish', finishReason: 'stop' }));
    response.end('data: [DONE]\n\n');
  }

  async close(): Promise<void> {
    const server = this.server;
    if (!server) {
      return;
    }
    this.server = null;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/**
 * Sends the assistant's route to the stream server instead of the API.
 *
 * Registered after the catch-all in `api.ts` so it wins, and it deliberately
 * only claims POSTs: the thread the bar reads on mount is a GET, which the
 * baseline answers with an empty object.
 */
export async function routeAssistant(page: Page, port: number): Promise<void> {
  await page.route('**/api/v1/assistant**', (route) => {
    if (route.request().method() !== 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      });
    }
    return route.continue({ url: `http://127.0.0.1:${port}/turn` });
  });
}
