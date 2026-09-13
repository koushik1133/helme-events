/**
 * users.js — the seeded workspace team.
 *
 * These are demo personas, not accounts. There is no password, no credential and
 * nothing to verify: picking a card on the sign-in screen simply chooses which
 * shape of the product you want to look at. See permissions.js for why that is
 * the only honest thing a front-end-only build can offer.
 *
 * Each user carries the two per-user override flags (the Dubsado pattern) so the
 * matrix can be widened for one named person without inventing a sixth role.
 */

import { ROLES } from './permissions.js';

/** Initials for the avatar chip — first letter of the first two words. */
function initialsOf(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('') || '?';
}

function seed(u) {
  return Object.freeze({
    canViewAllPipelines: false,
    canSeeMargin: false,
    ...u,
    initials: initialsOf(u.name)
  });
}

export const TEAM = Object.freeze([
  seed({
    id: 'u-rohan',
    name: 'Rohan Mehra',
    title: 'Founder & Director',
    role: ROLES.ADMIN,
    phone: '+91 98490 11002',
    // Redundant on Admin (the role already grants everything) but set explicitly
    // so the /roles table shows the flags as a real, inspectable column.
    canViewAllPipelines: true,
    canSeeMargin: true
  }),
  seed({
    id: 'u-priya',
    name: 'Priya Nair',
    title: 'Sales Manager — Client Servicing',
    role: ROLES.SALES_MANAGER,
    phone: '+91 98490 11045',
    // She runs the sales team, so she watches the whole board — but the flag
    // widens visibility of WORK only. Rupees stay scoped to her own deals and
    // margin stays shut. That is the deliberate line in the matrix.
    canViewAllPipelines: true,
    canSeeMargin: false
  }),
  seed({
    id: 'u-arjun',
    name: 'Arjun Rao',
    title: 'Event Manager — Production',
    role: ROLES.EVENT_MANAGER,
    phone: '+91 98490 11078',
    canViewAllPipelines: false,
    // Left false on purpose: the Event Manager sees contract value, never margin.
    canSeeMargin: false
  }),
  seed({
    id: 'u-meera',
    name: 'Meera Iyer',
    title: 'Finance & Accounts',
    role: ROLES.FINANCE,
    phone: '+91 98490 11091',
    canViewAllPipelines: false,
    canSeeMargin: false
  }),
  seed({
    id: 'u-vikram',
    name: 'Vikram Singh',
    title: 'Site Crew Lead',
    role: ROLES.CREW,
    phone: '+91 98490 11133',
    canViewAllPipelines: false,
    canSeeMargin: false
  })
]);

/** Look a seeded user up by id. Returns null, never undefined, never throws. */
export function getUserById(id) {
  if (typeof id !== 'string' || !id) return null;
  return TEAM.find(u => u.id === id) || null;
}

/** The first user holding a role — used for demo assignment of records. */
export function firstUserWithRole(role) {
  return TEAM.find(u => u.role === role) || null;
}

/** Display name for an id, for "assigned to" chips. */
export function displayName(id) {
  const u = getUserById(id);
  return u ? u.name : 'Unassigned';
}

export default TEAM;
