import assert from "node:assert/strict";
import { test } from "node:test";
import { requestLocation } from "../../src/lib/geolocation.ts";

function setup() {
  const calls = [], cleared = [], positions = [], errors = [];
  const api = {
    watchPosition(success, error, options) {
      calls.push({ success, error, options });
      return calls.length;
    },
    clearWatch(id) { cleared.push(id); },
  };
  const cancel = requestLocation(api, p => positions.push(p), e => errors.push(e));
  return { calls, cleared, positions, errors, cancel };
}
const position = { coords: { latitude: 37.5665, longitude: 126.978 } };

test("a delayed permission response is not discarded after 22 seconds", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const s = setup();
  t.mock.timers.tick(60000);
  assert.equal(s.errors.length, 0);
  s.calls[0].success(position);
  assert.deepEqual(s.positions, [position]);
  assert.deepEqual(s.cleared, [1]);
});

test("transient GPS failure retries once using network location", () => {
  const s = setup();
  assert.equal(s.calls[0].options.enableHighAccuracy, true);
  s.calls[0].error({ code: 3 });
  assert.equal(s.calls[1].options.enableHighAccuracy, false);
  s.calls[1].success(position);
  assert.deepEqual(s.positions, [position]);
  assert.deepEqual(s.cleared, [1, 2]);
});

test("permission denial stops immediately without retrying", () => {
  const s = setup();
  s.calls[0].error({ code: 1 });
  assert.equal(s.calls.length, 1);
  assert.equal(s.errors[0].code, 1);
  assert.deepEqual(s.cleared, [1]);
});

test("both providers failing reports an error and releases the watch", () => {
  const s = setup();
  s.calls[0].error({ code: 2 });
  s.calls[1].error({ code: 3 });
  assert.equal(s.calls.length, 2);
  assert.equal(s.errors[0].code, 3);
  assert.deepEqual(s.cleared, [1, 2]);
});

test("retrying or unmounting ignores callbacks from a cancelled request", () => {
  const s = setup();
  s.cancel();
  s.calls[0].success(position);
  s.calls[0].error({ code: 3 });
  assert.deepEqual(s.positions, []);
  assert.deepEqual(s.errors, []);
  assert.equal(s.calls.length, 1);
  assert.deepEqual(s.cleared, [1]);
});
