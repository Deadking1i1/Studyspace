type CommunityEnvironment = Readonly<{
  NODE_ENV?: string;
  NEXT_PUBLIC_STUDY_SPACE_COMMUNITY_ENABLED?: string;
}>;

export function isCommunityUiEnabled(environment: CommunityEnvironment = process.env) {
  const configuredValue = environment.NEXT_PUBLIC_STUDY_SPACE_COMMUNITY_ENABLED?.trim().toLowerCase();

  if (configuredValue === "true") return true;
  if (configuredValue === "false") return false;

  return environment.NODE_ENV !== "production";
}

export function CommunityUnavailable() {
  return (
    <section className="card unavailable-state" aria-labelledby="community-unavailable-heading">
      <p className="eyebrow">Community</p>
      <h1 id="community-unavailable-heading">Community is not available yet</h1>
      <p className="muted">
        Posting and study groups are temporarily unavailable while safety and moderation controls are being prepared.
      </p>
    </section>
  );
}
