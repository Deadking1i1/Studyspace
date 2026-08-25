import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityUnavailable, isCommunityUiEnabled } from "@/components/community/community-access";

describe("community production safeguarding", () => {
  it("fails closed in production unless explicitly enabled", () => {
    expect(isCommunityUiEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isCommunityUiEnabled({ NODE_ENV: "production", NEXT_PUBLIC_STUDY_SPACE_COMMUNITY_ENABLED: "false" })).toBe(false);
    expect(isCommunityUiEnabled({ NODE_ENV: "production", NEXT_PUBLIC_STUDY_SPACE_COMMUNITY_ENABLED: "true" })).toBe(true);
  });

  it("allows development by default and supports an explicit local disable", () => {
    expect(isCommunityUiEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isCommunityUiEnabled({ NODE_ENV: "development", NEXT_PUBLIC_STUDY_SPACE_COMMUNITY_ENABLED: "false" })).toBe(false);
  });

  it("renders a labelled and understandable unavailable state", () => {
    const markup = renderToStaticMarkup(createElement(CommunityUnavailable));

    expect(markup).toContain('aria-labelledby="community-unavailable-heading"');
    expect(markup).toContain('id="community-unavailable-heading"');
    expect(markup).toContain("Community is not available yet");
    expect(markup).toContain("safety and moderation controls");
  });
});
