export function initials(login: string): string {
  return login.slice(0, 2).toUpperCase()
}
