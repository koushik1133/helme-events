/**
 * session.js — who is currently signed in.
 *
 * Deliberately shaped exactly like src/data/eventState.js: one versioned
 * localStorage key, a sanitising loader, a read-only `get()`, and
 * `subscribe(fn)` returning an unsubscribe. Two observable singletons with two
 * different idioms would be a tax on every component that reads both.
 *
 * This is NOT authentication. Nothing is verified; the stored value is a user id
 * and anyone can change it in DevTools. It selects a persona, that is all.
 */

import { readJSON, writeJSON } from '../utils/format.js';
import { TEAM, getUserById } from './users.js';
import { ROLE_META } from './permissions.js';

export const SESSION_KEY = 'helm_session_v1';

/** Signed out is a first-class state: it is what a visitor sees first. */
const SIGNED_OUT = Object.freeze({ userId: null, signedInAt: null });

function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return { ...SIGNED_OUT };
  const user = getUserById(raw.userId);
  if (!user) return { ...SIGNED_OUT };
  return {
    userId: user.id,
    signedInAt: typeof raw.signedInAt === 'string' ? raw.signedInAt : new Date().toISOString()
  };
}

class Session {
  constructor() {
    this.state = sanitize(readJSON(SESSION_KEY, null));
    this.listeners = new Set();
  }

  /** Read-only snapshot: `{ userId, signedInAt }`. */
  get() {
    return { ...this.state };
  }

  /** The full user record, or null when signed out. Never a partial object. */
  getUser() {
    return getUserById(this.state.userId);
  }

  /** Role id of the current user, or null. */
  getRole() {
    const u = this.getUser();
    return u ? u.role : null;
  }

  /** Display metadata for the current role, or null. */
  getRoleMeta() {
    const role = this.getRole();
    return role ? ROLE_META[role] : null;
  }

  isSignedIn() {
    return this.getUser() !== null;
  }

  /** Everyone who can be picked. There is no hidden list. */
  listUsers() {
    return [...TEAM];
  }

  /**
   * Choose a persona. Returns the user, or null if the id is unknown.
   * `meta` is passed through to subscribers so a caller can say why.
   */
  signIn(userId, meta = {}) {
    const user = getUserById(userId);
    if (!user) return null;
    if (this.state.userId === user.id) return user;
    this.state = { userId: user.id, signedInAt: new Date().toISOString() };
    writeJSON(SESSION_KEY, this.state);
    this.notify(['userId'], { reason: 'sign-in', ...meta });
    return user;
  }

  /** Same mechanism as signIn; named separately because the intent differs. */
  switchUser(userId) {
    return this.signIn(userId, { reason: 'switch' });
  }

  /** Switch to the first seeded user holding `role`. */
  switchRole(role) {
    const user = TEAM.find(u => u.role === role);
    return user ? this.signIn(user.id, { reason: 'switch-role' }) : null;
  }

  signOut() {
    if (!this.state.userId) return;
    this.state = { ...SIGNED_OUT };
    writeJSON(SESSION_KEY, this.state);
    this.notify(['userId'], { reason: 'sign-out' });
  }

  /** `fn(snapshot, changedKeys, meta)`. Returns an unsubscribe function. */
  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(changedKeys, meta) {
    const snapshot = this.get();
    this.listeners.forEach(fn => {
      // One bad subscriber must never stop the others.
      try { fn(snapshot, changedKeys, meta); } catch { /* ignore */ }
    });
  }
}

/** The app-wide singleton. Import this, not the class. */
export const session = new Session();

export default session;
