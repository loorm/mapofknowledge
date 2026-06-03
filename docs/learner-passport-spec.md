# Learner Passport — Design Spec

> Working name. Alternatives considered: *Learning Record*, *Learning Wallet*, *Learning Book*.
> Final name should reflect the intended framing — "Wallet" emphasizes learner ownership and portability; "Record" emphasizes institutional authority; "Book" is warmer and more human.

## Purpose

Replace the report card / certificate model — a flat list of grades or a single subject name — with a richer, portable, learner-owned record of what someone has learned, how they learned it, and what they can do. Designed to capture **formal, non-formal, and informal learning** equally.

## Design principles

- **MECE substructure** — each fact has one obvious home.
- **Learner-owned, portable** — the record travels with the learner, not the institution.
- **Verifiable without phoning home** — issuer signatures, not centralized lookups.
- **Built on open standards** — interoperate, don't reinvent.
- **Plain language** — Nordic-style clarity in naming.

---

## Top-level structure

```
1. Profile              — who the learner is
2. Events               — what happened
3. Relationships        — who/what shaped learning
4. Credentials          — formal recognitions received
5. Competence           — current estimate of capability
6. Goals                — desired future states
```

### 1. Profile

Slimmed deliberately. Identity verification and contact data are the host system's concern, not the passport's.

- **Identity claims** — names the learner uses; optionally date of birth or other anchoring facts as needed for credential matching.
- **Identity bindings** *(optional)* — cryptographic key (DID) or external identifier (e.g. EU eIDAS) that lets a verifier confirm the passport refers to the person presenting it.
- **How I learn** — preferences, modalities, accessibility needs, accommodations.
- **Interests & values** *(optional)* — what draws the learner, what matters to them. May be derivable from Events + Goals rather than declared.

> Languages are **not** here. Heritage and learned languages alike live under Competence → Skills, since they are capabilities, not biography.

### 2. Events

- **Activities** — courses, projects, experiences, study sessions (the episodes themselves).
- **Evidence** — artifacts produced: work samples, recordings, products, deliverables.
- **Assessments** — evaluations during or after: tests, performances, peer review, feedback.
- **Reflections** — the learner's own account of the episode.

### 3. Relationships

Persistent record of people/groups/systems that shaped learning. Referenced from Events rather than duplicated per event.

- **Individuals** — teachers, mentors, coaches, peers.
- **Groups** — cohorts, study circles, teams, communities of practice.
- **Institutions** — schools, employers, training providers.
- **Systems** — platforms, AI tutors, tools that materially shaped learning.

### 4. Credentials

- **Qualifications** — degrees, diplomas (long-form, accredited).
- **Certifications & badges** — skill- or course-specific issued credentials.
- **Licenses** — legal authorization to practice.
- **Awards & endorsements** — distinctions, honors, testimonials.

### 5. Competence

- **Knowledge** — concepts, facts, theories the learner holds.
- **Skills** — what they can do, including all languages (heritage, native, learned).
- **Dispositions** — habits of mind, attitudes, character traits.
- **Meta-competence** *(optional, may fold into Dispositions)* — self-regulation, learning-to-learn.

### 6. Goals

- **Aspirations** — long-term direction, who/what they want to become.
- **Objectives** — specific outcomes to achieve: skills, credentials, experiences.
- **Plans** — concrete next steps with timelines.

---

## Cross-cutting relationships

These keep the model MECE while letting facts inform each other:

- **Credentials reference Events.** Receiving a degree is also an event. The Credential is the primary record; it back-references the Event that produced it. No duplication.
- **Assessments inform Competence.** Assessments live in Events (they happened at a time, with evidence). Competence is updated by them via explicit links, not by copying data.
- **Reflections feed Profile over time.** Reflections live in Events as source of truth. Profile fields (e.g. interests) can cite them.
- **Relationships are referenced, not embedded.** Every Event has people attached, but the Relationship record is the one source — supports queries like "all mentors across time."

---

## Technical format: JSON-LD, not XML

**Decision: use JSON-LD as the wire format**, building on existing vocabularies rather than inventing a custom schema.

### Why JSON-LD

- Modern equivalent of XML for structured, semantically rich data.
- Adds a `@context` field that maps your terms to shared public definitions — so different systems mean the same thing by the same word, without bilateral agreements.
- Still readable as plain JSON by systems that don't care about Linked Data.
- It's what the relevant ecosystem (W3C Verifiable Credentials, European Learning Model, 1EdTech CLR) has converged on.

### Vocabularies to build on

| Passport branch | Existing standard to reuse |
|---|---|
| Credentials | **W3C Verifiable Credentials** (JSON-LD, cryptographically signed) |
| Events | **xAPI** (actor / verb / object / result) — JSON, easy to wrap as JSON-LD |
| Competence (skills) | **ESCO** — EU's Skills/Competences/Qualifications/Occupations classification |
| General entities | **schema.org** (Person, Organization, LearningResource, etc.) |
| Holistic record | **1EdTech Comprehensive Learner Record (CLR) v2.0** — bundles VCs into a complete learner record |
| EU context | **European Learning Model (ELM) v3** — EU's JSON-LD extension of W3C VC |

Define proprietary terms (e.g. for Reflections, Relationships, Goals) as a project-specific JSON-LD context, published at a stable URL.

### Strategic positioning — where to reuse, where to innovate

The existing standards stack is **credential-heavy and institution-centric**. It is strong at "this person earned this thing from this issuer, signed and verifiable." It is weak at the more humanistic, learner-authored parts of a learning record.

**Build on existing standards for:**
- Credentials (W3C VC + ELM + CLR)
- Skills taxonomy references (ESCO)
- Event records (xAPI)
- Identity binding (DIDs)

**Put original design effort into the parts the standards do not cover well:**
- **Reflections** — the learner's own narrative voice. No standard captures this meaningfully.
- **Relationships** — most standards model issuers, not the broader network of teachers, peers, and mentors who shaped learning.
- **Goals** — credentials are backward-looking; goals are forward-looking and largely missing from existing models.
- **Profile (How I learn, Interests & values)** — declarative learner self-description, not institutionally observed data.

This positioning matters: it lets the project plug into the existing credential ecosystem (instant interoperability with EU systems, employer ATSes, university registries) while making a genuine contribution where the field is thin.

### Identity & portability

- **No system-specific stable ID inside the passport.** That would defeat portability.
- Use **DIDs (Decentralized Identifiers)** for cryptographic identity binding, OR
- Rely on **issuer-signed VCs** with self-asserted identity claims (the digital equivalent of a paper diploma).
- The host system handles its own internal IDs; they are not part of the portable record.

---

## Open questions

1. Final name for the project.
2. Whether *Interests & values* in Profile is declared or derived.
3. Whether *Meta-competence* is its own branch or folded into Dispositions.
4. Granularity of Competence claims — single skills, skill bundles, or both?
5. Privacy model — does the learner share the whole passport, or selectively disclose? (W3C VC supports selective disclosure via BBS+ signatures; worth designing for.)
6. Whether to integrate with national identity systems (e.g. Estonian isikukood, EU eIDAS) for issuer trust or remain fully decentralized.
