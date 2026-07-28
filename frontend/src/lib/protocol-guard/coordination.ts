/**
 * Coordinated voting heuristic (pure — no server deps).
 * Many low-trust voters on the same proposal with similar sparse histories
 * = coordination risk signal (not graph EigenTrust).
 */
export function detectCoordinatedVoting(
  voterScores: Array<{ wallet: string; score: number; tier: string }>,
  clusterThreshold = 5
): { coordinated: boolean; lowTrustCluster: number; detail: string } {
  const low = voterScores.filter((v) => v.score < 40);
  if (low.length >= clusterThreshold) {
    return {
      coordinated: true,
      lowTrustCluster: low.length,
      detail: `${low.length} low-trust wallets voting in the same window`,
    };
  }
  if (voterScores.length >= clusterThreshold) {
    const scores = voterScores.map((v) => v.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    if (max - min <= 8 && min < 50) {
      return {
        coordinated: true,
        lowTrustCluster: voterScores.length,
        detail: "Vote cluster shows tightly banded low-medium scores",
      };
    }
  }
  return {
    coordinated: false,
    lowTrustCluster: low.length,
    detail: "No coordination pattern above threshold",
  };
}
