/** Name for the user menu: the GitHub display name, else the GitHub username. */
export function displayName(user: { name?: string | null; username?: string | null }): string {
	return user.name || user.username || 'Account';
}
