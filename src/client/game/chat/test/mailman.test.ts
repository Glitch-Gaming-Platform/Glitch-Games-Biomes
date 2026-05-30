import { MailMan } from "@/client/game/chat/mailman";
import type { Delivery, Envelope } from "@/shared/chat/types";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

const USER_ID = 1 as BiomesId;
const OTHER_ID = 2 as BiomesId;

function testEnvelope(overrides: Partial<Envelope> = {}): Envelope {
  return {
    id: "message-1",
    createdAt: Date.now(),
    localTime: Date.now(),
    from: OTHER_ID,
    to: USER_ID,
    message: {
      kind: "text",
      content: "hello",
    },
    ...overrides,
  };
}

function createMailman(initialDeliveries: Delivery[] = []) {
  const state = {
    chat: { messages: [] as Envelope[] },
    dms: { messages: [] as Envelope[] },
  };
  const events: unknown[] = [];
  const resources = {
    update(path: string, fn: (resource: { messages: Envelope[] }) => void) {
      if (path === "/chat") {
        fn(state.chat);
      } else if (path === "/dms") {
        fn(state.dms);
      } else {
        throw new Error(`Unexpected resource path ${path}`);
      }
    },
  };
  const gardenHose = {
    publish(event: unknown) {
      events.push(event);
    },
  };
  const mailman = new MailMan(
    USER_ID,
    resources as any,
    { deliveries: initialDeliveries } as any,
    gardenHose as any
  );
  return {
    events,
    mailman,
    state,
    stop: () => {
      const handle = (mailman as any).gcHandle;
      if (handle) {
        clearTimeout(handle);
      }
    },
  };
}

describe("MailMan", () => {
  let stop: (() => void) | undefined;

  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  it("applies unsend deliveries to chat and recent world text", () => {
    const setup = createMailman();
    stop = setup.stop;
    const envelope = testEnvelope({ to: undefined });

    setup.mailman.accept({
      channelName: "chat",
      mail: [envelope],
    });
    assert.deepEqual(
      setup.state.chat.messages.map((message) => message.id),
      [envelope.id]
    );
    assert.equal(setup.mailman.recentTexts.get(OTHER_ID)?.id, envelope.id);

    setup.mailman.accept({
      channelName: "chat",
      unsend: [
        {
          from: envelope.from,
          message: envelope.message,
        },
      ],
    });

    assert.deepEqual(setup.state.chat.messages, []);
    assert.equal(setup.mailman.recentTexts.has(OTHER_ID), false);
    assert.equal(setup.events.length, 1);
  });

  it("applies dm unsends to both chat and dm views", () => {
    const setup = createMailman();
    stop = setup.stop;
    const envelope = testEnvelope();

    setup.mailman.accept({
      channelName: "dm",
      mail: [envelope],
    });
    assert.deepEqual(
      setup.state.chat.messages.map((message) => message.id),
      [envelope.id]
    );
    assert.deepEqual(
      setup.state.dms.messages.map((message) => message.id),
      [envelope.id]
    );

    setup.mailman.accept({
      channelName: "dm",
      unsend: [
        {
          from: envelope.from,
          to: envelope.to,
          message: envelope.message,
        },
      ],
    });

    assert.deepEqual(setup.state.chat.messages, []);
    assert.deepEqual(setup.state.dms.messages, []);
  });
});
