const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const authSource = fs.readFileSync(path.join(__dirname, 'auth.js'), 'utf8');

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }
  get length() {
    return this.store.size;
  }
  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(String(key), String(value));
  }
  removeItem(key) {
    this.store.delete(String(key));
  }
  clear() {
    this.store.clear();
  }
}

function createHarness({ online = true, serverSelections } = {}) {
  const localStorage = new LocalStorageMock();
  const server = {
    username: 'alice',
    sessionToken: 'token-1',
    selections: JSON.parse(JSON.stringify(serverSelections || {
      favorites: [],
      favorites_meta: { updatedAt: null, lastSyncedAt: null, pendingSync: false, deviceId: null, baseCloudUpdatedAt: null },
      pages: {},
      pages_meta: {},
      program: '',
      exercise_plan: {},
      weekly_table: {},
      gym_table: {},
      planner: null,
      gym_plans: {}
    }))
  };

  const noop = () => {};
  const elementFactory = () => ({
    style: {},
    dataset: {},
    className: '',
    textContent: '',
    innerHTML: '',
    setAttribute: noop,
    removeAttribute: noop,
    insertAdjacentElement: noop,
    appendChild: noop,
    querySelector: () => null,
    classList: { add: noop, remove: noop, contains: () => false, toggle: noop }
  });

  const document = {
    readyState: 'loading',
    visibilityState: 'visible',
    addEventListener: noop,
    getElementById: () => null,
    querySelector: () => null,
    createElement: elementFactory,
    head: { appendChild: noop },
    body: {
      classList: { add: noop, remove: noop, contains: () => false },
      querySelector: () => null
    }
  };

  const navigator = {
    onLine: online,
    serviceWorker: { register: async () => ({}) }
  };

  const window = {
    addEventListener: noop,
    removeEventListener: noop,
    location: { pathname: '/BackE.html', href: 'http://localhost/BackE.html' },
    document,
    navigator
  };

  const context = {
    console,
    localStorage,
    navigator,
    document,
    window,
    crypto: { randomUUID: () => 'uuid-1' },
    setTimeout: () => 1,
    clearTimeout: noop,
    Response,
    fetch: async (endpoint, options = {}) => {
      const body = JSON.parse(options.body || '{}');
      if (endpoint === '/api/users-fetch') {
        if (body.username !== server.username || body.authToken !== server.sessionToken) {
          return { ok: false, statusText: 'Unauthorized', json: async () => ({ error: 'Unauthorized session.' }) };
        }
        return { ok: true, json: async () => ({ user: { username: server.username, selections: JSON.parse(JSON.stringify(server.selections)) } }) };
      }
      if (endpoint === '/api/users-save') {
        if (body.username !== server.username || body.authToken !== server.sessionToken) {
          return { ok: false, statusText: 'Unauthorized', json: async () => ({ error: 'Unauthorized session.' }) };
        }
        if (body.payload && body.payload.selections) {
          server.selections = JSON.parse(JSON.stringify(body.payload.selections));
        }
        return { ok: true, json: async () => ({ ok: true, user: { username: server.username, selections: JSON.parse(JSON.stringify(server.selections)) } }) };
      }
      throw new Error(`Unhandled fetch endpoint: ${endpoint}`);
    }
  };

  context.window.window = window;
  context.window.localStorage = localStorage;
  context.window.crypto = context.crypto;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(authSource, context, { filename: 'auth.js' });

  localStorage.setItem('authSession', JSON.stringify({ username: 'alice', token: 'token-1' }));
  localStorage.setItem('currentUser', 'alice');

  return { context, localStorage, server, navigator };
}

function readJson(storage, key) {
  const raw = storage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

async function run() {
  const tests = [];

  tests.push(async () => {
    const { context, server } = createHarness();
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    assert.deepStrictEqual(server.selections.favorites.map(x => x.id), ['a']);
  });

  tests.push(async () => {
    const { context, server } = createHarness({ serverSelections: { favorites: [{ id: 'a', title: 'A', img: '1' }], favorites_meta: {}, pages: {}, pages_meta: {}, program: '', exercise_plan: {}, weekly_table: {}, gym_table: {}, planner: null, gym_plans: {} } });
    await context.initializeFavoritesSync(true);
    await context.removeFavoriteSelection('a');
    assert.deepStrictEqual(server.selections.favorites, []);
  });

  tests.push(async () => {
    const { context, server } = createHarness({ serverSelections: { favorites: [{ id: 'a', title: 'A', img: '1' }], favorites_meta: {}, pages: {}, pages_meta: {}, program: '', exercise_plan: {}, weekly_table: {}, gym_table: {}, planner: null, gym_plans: {} } });
    await context.initializeFavoritesSync(true);
    await context.removeFavoriteSelection({ id: 'a', title: 'A', img: '1' });
    assert.deepStrictEqual(server.selections.favorites, []);
  });

  tests.push(async () => {
    const { context, server } = createHarness();
    await context.toggleFavoriteSelection({ id: 'a', title: 'A', img: '1' });
    await context.toggleFavoriteSelection({ id: 'a', title: 'A', img: '1' });
    assert.deepStrictEqual(server.selections.favorites, []);
  });

  tests.push(async () => {
    const { context, server } = createHarness();
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    assert.deepStrictEqual(server.selections.favorites.map(x => x.id), ['a']);
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness({ online: false });
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    const draft = readJson(localStorage, 'gymrat:favorites:draft:alice');
    assert.deepStrictEqual(draft.favorites.map(x => x.id), ['a']);
    assert.strictEqual(draft.pendingSync, true);
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness({ online: false });
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    await context.removeFavoriteSelection('a');
    const draft = readJson(localStorage, 'gymrat:favorites:draft:alice');
    assert.deepStrictEqual(draft.favorites, []);
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness({ online: false });
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    await context.removeFavoriteSelection({ id: 'a', title: 'A', img: '1' });
    const draft = readJson(localStorage, 'gymrat:favorites:draft:alice');
    assert.deepStrictEqual(draft.favorites, []);
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness({
      serverSelections: { favorites: [{ id: 'a', title: 'A', img: '1' }], favorites_meta: { updatedAt: '2026-01-01T00:00:00.000Z' }, pages: {}, pages_meta: {}, program: '', exercise_plan: {}, weekly_table: {}, gym_table: {}, planner: null, gym_plans: {} }
    });
    localStorage.setItem('gymrat:favorites:draft:alice', JSON.stringify({ favorites: [], updatedAt: '2026-01-02T00:00:00.000Z', pendingSync: false }));
    const favs = await context.getSyncedFavorites(true);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(favs)), []);
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness({
      serverSelections: { favorites: [{ id: 'a', title: 'A', img: '1' }], favorites_meta: { updatedAt: '2026-01-03T00:00:00.000Z' }, pages: {}, pages_meta: {}, program: '', exercise_plan: {}, weekly_table: {}, gym_table: {}, planner: null, gym_plans: {} }
    });
    localStorage.setItem('gymrat:favorites:draft:alice', JSON.stringify({ favorites: [], updatedAt: '2026-01-02T00:00:00.000Z', pendingSync: false }));
    const favs = await context.getSyncedFavorites(true);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(favs)).map(x => x.id), ['a']);
  });

  tests.push(async () => {
    const { context } = createHarness();
    const snapshots = [];
    context.subscribeFavoritesSync(favs => snapshots.push(favs.map(x => x.id).join(',')));
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    await context.removeFavoriteSelection('a');
    assert.ok(snapshots.includes('a'));
    assert.ok(snapshots.includes(''));
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness();
    localStorage.setItem('gymrat:favorites:draft:alice', JSON.stringify({ favorites: [{ id: 'a', title: 'A', img: '1' }, { id: 'a', title: 'A', img: '1' }], updatedAt: '2026-01-02T00:00:00.000Z', pendingSync: true }));
    const favs = await context.getSyncedFavorites(true);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(favs)).map(x => x.id), ['a']);
  });

  tests.push(async () => {
    const { context, server } = createHarness();
    await context.setFavoriteSelection({ id: 'missing', title: 'M', img: '1' }, false);
    assert.deepStrictEqual(server.selections.favorites, []);
  });

  tests.push(async () => {
    const { context } = createHarness();
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    const result = await context.removeFavoriteSelection('a');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(result.favorites || result)), []);
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness({ online: false });
    localStorage.setItem('gymrat:favorites:draft:alice', JSON.stringify({ favorites: [{ id: 'a', title: 'A', img: '1' }], updatedAt: '2026-01-01T00:00:00.000Z', pendingSync: true }));
    await context.initializeFavoritesSync(true);
    await context.removeFavoriteSelection('a');
    const cached = readJson(localStorage, 'gymrat:userdoc:alice');
    assert.deepStrictEqual(cached.selections.favorites, []);
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness();
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    await context.removeFavoriteSelection('a');
    const cached = readJson(localStorage, 'gymrat:userdoc:alice');
    assert.deepStrictEqual(cached.selections.favorites, []);
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness();
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    assert.strictEqual(readJson(localStorage, 'gymrat:pending:selections:alice'), null);
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness({ online: false });
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, true);
    await context.removeFavoriteSelection('a');
    const pending = readJson(localStorage, 'gymrat:pending:selections:alice');
    assert.deepStrictEqual(pending.favorites, []);
  });

  tests.push(async () => {
    const { context, server } = createHarness({
      serverSelections: { favorites: [{ id: 'a', title: 'A', img: '1' }], favorites_meta: { updatedAt: '2026-01-01T00:00:00.000Z' }, pages: {}, pages_meta: {}, program: '', exercise_plan: {}, weekly_table: {}, gym_table: {}, planner: null, gym_plans: {} }
    });
    await context.initializeFavoritesSync(true);
    await context.setFavoriteSelection({ id: 'a', title: 'A', img: '1' }, false);
    assert.deepStrictEqual(server.selections.favorites, []);
  });

  tests.push(async () => {
    const { context, server } = createHarness();
    const item = { id: 'Cable crunches_/BackE.html', title: 'Cable crunches', img: 'img' };
    await context.setFavoriteSelection(item, true);
    await context.removeFavoriteSelection('Cable crunches_/BackE.html');
    assert.deepStrictEqual(server.selections.favorites, []);
  });

  tests.push(async () => {
    const { context, localStorage } = createHarness({
      serverSelections: {
        favorites: [],
        favorites_meta: { updatedAt: '2026-01-03T00:00:00.000Z', lastSyncedAt: '2026-01-03T00:00:00.000Z' },
        pages: {},
        pages_meta: {},
        program: '',
        exercise_plan: {},
        weekly_table: {},
        gym_table: {},
        planner: null,
        gym_plans: {}
      }
    });
    localStorage.setItem('gymrat:favorites:draft:alice', JSON.stringify({
      favorites: [{ id: 'Hammer curls_/ForearmsE.html', title: 'Hammer curls', img: 'img' }],
      updatedAt: '2026-01-04T00:00:00.000Z',
      pendingSync: true
    }));
    localStorage.setItem('gymrat:pending:selections:alice', JSON.stringify({
      favorites: [{ id: 'Hammer curls_/ForearmsE.html', title: 'Hammer curls', img: 'img' }]
    }));

    await context.syncAccountStateFromCloud('alice');

    const draft = readJson(localStorage, 'gymrat:favorites:draft:alice');
    assert.deepStrictEqual(draft.favorites, [{ id: 'Hammer curls_/ForearmsE.html', title: 'Hammer curls', img: 'img' }]);
    assert.strictEqual(draft.pendingSync, true);
    assert.deepStrictEqual(readJson(localStorage, 'gymrat:pending:selections:alice'), {
      favorites: [{ id: 'Hammer curls_/ForearmsE.html', title: 'Hammer curls', img: 'img' }]
    });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(await context.getSyncedFavorites())), [{ id: 'Hammer curls_/ForearmsE.html', title: 'Hammer curls', img: 'img' }]);
  });

  for (let i = 0; i < tests.length; i += 1) {
    await tests[i]();
    console.log(`test ${i + 1} passed`);
  }

  console.log(`all ${tests.length} tests passed`);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});

