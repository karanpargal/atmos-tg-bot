export function checkCooldown(
  tokenSymbol: string,
  lastClaimed: { [key: string]: number }
): boolean {
  const lastClaimTime = lastClaimed[tokenSymbol];
  if (!lastClaimTime) return true;

  const hourInSeconds = 60 * 60;
  const currentTimeSeconds = Math.floor(Date.now() / 1000);
  const timeSinceLastClaim = currentTimeSeconds - lastClaimTime;
  return timeSinceLastClaim >= hourInSeconds;
}

export function getTimeRemaining(
  tokenSymbol: string,
  lastClaimed: { [key: string]: number }
): string {
  const lastClaimTime = lastClaimed[tokenSymbol];
  if (!lastClaimTime) return "Ready";

  const hourInSeconds = 60 * 60;
  const currentTimeSeconds = Math.floor(Date.now() / 1000);
  const timeSinceLastClaim = currentTimeSeconds - lastClaimTime;
  const timeRemaining = hourInSeconds - timeSinceLastClaim;

  if (timeRemaining <= 0) return "Ready";

  const minutes = Math.ceil(timeRemaining / 60);
  return `${minutes}m`;
}
