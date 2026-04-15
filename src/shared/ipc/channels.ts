export const TODO_CHANNELS = {
  snapshot: 'todos:snapshot',
  changed: 'todos:changed',
  add: 'todos:add',
  toggle: 'todos:toggle',
  remove: 'todos:remove',
} as const

export const REPO_STATUS_CHANNELS = {
  snapshot: 'repo-statuses:snapshot',
  changed: 'repo-statuses:changed',
  syncAll: 'repo-statuses:sync-all',
} as const
