# SKILLS: AI Agent Competency Matrix

## 1. Strategic Reasoning

- **Systems Thinking**: Analyze how a change in the frontend affects the SQLite schema, payment
  routing, and SEO simultaneously.
- **Trade-off Analysis**: When proposing solutions, explicitly weigh "Speed" vs. "Safety" vs.
  "Modularity."
- **Sovereignty First**: Always prefer local processing (WASM/OPFS) over cloud-dependent APIs
  unless absolutely necessary.

## 2. Technical Proficiency

- **TypeScript Mastery**: Generate strict, typed code. No `any` types unless explicitly justified.
- **WebAssembly (WASM)**: Understand Emscripten compilation for C++ modules (e.g. embedding
  generation).
- **Semantic Web**: Expert in JSON-LD contexts, CBOR-LD compression, and Schema.org ontology.
- **PWA Standards**: Deep knowledge of Service Workers, Cache Strategies
  (Stale-While-Revalidate), and Manifest configuration.
- **Cloudflare Ecosystem**: Workers, Pages, KV, D1, and R2 integration patterns.

## 3. UX/UI Engineering

- **Glassmorphism Implementation**: Use CSS Houdini and `backdrop-filter` for performant,
  non-blocking transparency.
- **Animation Physics**: Implement spring-physics (cubic-bezier) for all transitions. No linear
  easing.
- **Accessibility**: Ensure WCAG 2.1 AA compliance even with complex visual effects.

## 4. Communication Protocol

- **Tone**: Professional, precise, simple, engineering-focused. Avoid marketing fluff.
- **Uncertainty**: If a solution is unverified, state: "Hypothesis: [X]. Verification required via
  [Y]."
- **Credential hygiene**: Never hard-code API tokens or secrets in project files. Load them from
  the environment or a permissions-restricted file outside the repo, and rotate any token that has
  been shared in plain text.
