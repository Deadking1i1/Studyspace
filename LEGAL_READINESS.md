# Study Space Legal Readiness Tracker

This tracker is an operational checklist for Study Space's legal and product-readiness work. It is not legal advice and should be reviewed by qualified counsel before public launch, commercial use, school deployment, or onboarding minors.

## Current Attorney-Review Drafts

The `legal docments` folder currently contains founder/contributor legal drafts and `Terms_of_Service_v1.docx`. These are drafting aids only.

| Document | Status | Launch dependency |
| --- | --- | --- |
| Terms of Service | Drafted for counsel review | Required before public launch |
| Privacy Policy | Not yet drafted in this repo | Required before collecting real user data |
| Community Guidelines | Not yet drafted in this repo | Required before scaling feed, groups, World Chat, or private messaging |
| AI Use Policy | Not yet drafted in this repo | Required before external or generative AI features go live |
| Copyright Policy | Not yet drafted in this repo | Required before public uploads, public notes, or public community sharing |
| Security Policy | Partially covered by `SECURITY.md` | Should be user-facing before launch |
| Payment Terms | Future-ready ToS language only | Required before paid features |
| Third-Party Notices | Not yet drafted in this repo | Required before public/commercial distribution |

## Priority Legal/Product Risks

- Students and minors may trigger heightened privacy, safety, consent, moderation, and educational-record obligations.
- AI Features can create academic-integrity, hallucination, plagiarism, citation, transparency, and provider data-processing risks.
- Community features can create harassment, harmful content, copyright, defamation, privacy, and moderation consistency risks.
- Private messaging and World Chat require abuse-reporting workflows, blocking tools, moderation queues, retention rules, and safety escalation before scale.
- File uploads and PDF embeds can introduce malware, copyright, leaked exam, personal data, and third-party content risks.
- SQLite is appropriate for development, but production should use managed PostgreSQL or equivalent backups and operational controls.

## Launch Gates

Do not launch Study Space publicly until these items are complete:

- Counsel has approved Terms of Service, Privacy Policy, Community Guidelines, AI Use Policy, Copyright Policy, and Payment Terms if paid features are enabled.
- The operator legal name, address, support email, security email, copyright contact, governing law, and dispute forum are finalized.
- The product has clear in-app disclosures for public content, group-shared content, AI processing, uploads, PDF embeds, and audit/security record retention.
- Reporting, blocking, moderation review, content-removal, and appeal workflows are implemented before World Chat or private messaging scale beyond trusted testers.
- The project license strategy is chosen and documented in a real `LICENSE` file.
- Third-party dependency notices are generated and reviewed.
- Production uses a managed database, backups, Redis-backed rate limiting, HTTPS, SMTP, and a strong production secret key.

## Document Control

Each legal document should include:

- document name;
- version number;
- effective date;
- approval status;
- reviewer;
- change summary;
- publication location;
- replacement/supersession history.

Keep draft legal files out of the live app UI until approved. Published legal pages should be versioned and should preserve historical effective versions.
