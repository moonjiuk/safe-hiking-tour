import assert from "node:assert/strict";
import { test } from "node:test";
import { requestLocation, LOCATION_TIMEOUT } from "../../src/lib/geolocation.ts";

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
  return { api, calls, cleared, positions, errors, cancel };
}
const position = { coords: { latitude: 37.5665, longitude: 126.978 } };

test("permission prompt time is not treated as acquisition failure", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const s = setup();
  t.mock.timers.tick(60000);
  assert.equal(s.errors.length, 0);
  s.calls[0].success(position);
  assert.deepEqual(s.positions, [position]);
  assert.deepEqual(s.cleared, [1]);
});

test("request the quickest available fix with an eight-second acquisition budget", () => {
  const s = setup();
  assert.deepEqual(s.calls[0].options, { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT, maximumAge: 10000 });
  assert.equal(LOCATION_TIMEOUT, 8000);
  s.cancel();
});

test("timeout is reported without another long automatic retry", () => {
  const s = setup();
  s.calls[0].error({ code: 3 });
  assert.equal(s.calls.length, 1);
  assert.equal(s.errors[0].code, 3);
  assert.deepEqual(s.cleared, [1]);
});

test("permission denial stops immediately", () => {
  const s = setup();
  s.calls[0].error({ code: 1 });
  assert.equal(s.calls.length, 1);
  assert.equal(s.errors[0].code, 1);
  assert.deepEqual(s.cleared, [1]);
});

test("cancelled requests cannot move the map or report errors", () => {
  const s = setup();
  s.cancel();
  s.calls[0].success(position);
  s.calls[0].error({ code: 3 });
  assert.deepEqual(s.positions, []);
  assert.deepEqual(s.errors, []);
  assert.deepEqual(s.cleared, [1]);
});

test("a successful watch stops and ignores subsequent updates", () => {
  const s = setup();
  s.calls[0].success(position);
  s.calls[0].success(position);
  assert.equal(s.positions.length, 1);
  assert.deepEqual(s.cleared, [1]);
});

test("a recent fix moves immediately without starting a new location request", async () => {
  const s = setup();
  s.calls[0].success(position);
  let result;
  requestLocation(s.api, p => { result = p; }, assert.fail);
  await Promise.resolve();
  assert.equal(result, position);
  assert.equal(s.calls.length, 1);
});

test("a fix older than ten seconds is acquired again", t => {
  t.mock.timers.enable({ apis: ["Date"] });
  const s = setup();
  s.calls[0].success(position);
  t.mock.timers.tick(10001);
  const cancel = requestLocation(s.api, assert.fail, assert.fail);
  assert.equal(s.calls.length, 2);
  cancel();
});
