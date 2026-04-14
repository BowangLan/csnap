export const TODO_CHANNELS = {
  snapshot: 'todos:snapshot',
  changed: 'todos:changed',
  add: 'todos:add',
  toggle: 'todos:toggle',
  remove: 'todos:remove',
} as const

export const REPO_STATUS_CHANNELS = {
  /** Renderer → main: request current snapshot. */
  snapshot: 'repo-statuses:snapshot',
  /** Main → renderer: push updated snapshot. */
  changed: 'repo-statuses:changed',
  /** Renderer → main: trigger an immediate sync of all configured repos. */
  syncAll: 'repo-statuses:sync-all',
} as const
