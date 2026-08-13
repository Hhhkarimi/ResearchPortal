function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function hostOf(value) {
  try {
    return new URL(String(value ?? "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function evidenceUrl(item) {
  return item?.url || item?.sourceUrl || item?.parentUrl || null;
}

export function hasDedicatedOfficialHub(units, researchUrl) {
  const portalHost = hostOf(researchUrl);

  return (units || []).some((item) => {
    if (!["industry", "technology"].includes(item?.type)) return false;

    const host = hostOf(evidenceUrl(item));
    if (!host) return false;

    if (portalHost && host !== portalHost) return true;

    return /^(?:industry|innovation|technology|techtransfer|ttc|growth|incubator)\./i.test(host);
  });
}

export function scoreIndustryTechnology({
  verified,
  units = [],
  systems = [],
  researchUrl = null,
} = {}) {
  if (!verified) return null;

  const unitTypes = new Set(units.map((item) => item?.type).filter(Boolean));
  const systemCategories = new Set(systems.map((item) => item?.category).filter(Boolean));

  const hasIndustry = unitTypes.has("industry");
  const hasTechnology = unitTypes.has("technology");
  const hasRelevantUnit = hasIndustry || hasTechnology;
  const hasRelevantSystem = systemCategories.has("industry") || systemCategories.has("innovation");

  let score = 0;

  // Existence of a verified dedicated industry/technology function is the main signal.
  if (hasRelevantUnit) score += 55;

  // Breadth across both industry liaison and technology transfer/innovation.
  if (hasIndustry && hasTechnology) score += 20;

  // A dedicated official hub/subdomain is strong maturity evidence and must not be
  // penalized merely because no side-system endpoint was discovered.
  if (hasDedicatedOfficialHub(units, researchUrl)) score += 20;

  // A research-facing industry/innovation system is a useful supplement, not a gate.
  if (hasRelevantSystem) score += 5;

  // If only a verified system exists, acknowledge it without pretending a unit exists.
  if (!hasRelevantUnit && hasRelevantSystem) score = Math.max(score, 35);

  return clamp(score);
}

export function scoreFindability({
  researchUrl = null,
  units = [],
  systems = [],
  documents = [],
  systemsStatus = "unresolved",
  systemReferenceCount = 0,
  documentsVerified = false,
} = {}) {
  let sum = researchUrl ? 35 : 0;
  let weight = 35;

  if (units.length) {
    sum += 25 * Math.min(1, units.filter((item) => item?.url || item?.sourceUrl).length / units.length);
    weight += 25;
  }

  // Findability is about whether a user can reach the actual system endpoint.
  // If we have public references to a system but no proven endpoint, keep the
  // systems share in the denominator even when the cleaned deep-audit state is
  // now "unresolved". This prevents cleaning a false-positive endpoint from
  // accidentally turning findability into 100.
  const hasSystemExistenceEvidence =
    systems.length > 0 ||
    Number(systemReferenceCount || 0) > 0 ||
    ["verified", "observed-reference"].includes(systemsStatus);

  if (hasSystemExistenceEvidence) {
    const denominator = Math.max(1, systems.length);
    sum += 20 * Math.min(1, systems.filter((item) => item?.url).length / denominator);
    weight += 20;
  }

  if (documentsVerified && documents.length) {
    sum += 20 * Math.min(1, documents.filter((item) => item?.url).length / documents.length);
    weight += 20;
  }

  return clamp((100 * sum) / weight);
}

export function scoreCoverageAdjustment({
  score,
  activeWeight,
  neutralPrior = 50,
} = {}) {
  const baseScore = clamp(Number(score || 0));
  const activeRatio = Math.max(0, Math.min(1, Number(activeWeight || 0) / 100));
  const prior = clamp(Number(neutralPrior));

  // Strict evidence-backed score: unresolved weight contributes nothing. This is
  // exposed for transparency only; it is deliberately NOT the public rank key.
  const coverageAdjustedScore = clamp(baseScore * activeRatio);

  // Ranking score: shrink the active-dimension score toward a neutral prior for
  // unresolved weight. This restrains artificial rank jumps without claiming
  // that an unresolved dimension has quality zero.
  const rankingScore = clamp(
    baseScore * activeRatio +
    prior * (1 - activeRatio)
  );

  return {
    coverageAdjustedScore,
    rankingScore,
    activeRatio,
    neutralPrior: prior,
  };
}
