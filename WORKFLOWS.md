# WORKFLOWS: Standard Operating Procedures

## Workflow A: Feature Request & Implementation

1. **Analyze**: Break down the user request against `CONTEXT.md` criteria (Robustness,
   Sovereignty).
2. **Plan**: Outline the file changes required (Frontend, Backend, Config).
3. **Verify**: Check if dependencies exist in `TOOLS.md`.
4. **Execute**:
   - Output **ONE** consolidated code block (using `cat > file << 'EOF'`).
   - Include migration scripts if database schemas change.
5. **Validate**: Simulate the command sequence (`git add`, `commit`, `deploy`).
6. **Report**: Confirm success or list specific failure points.

## Workflow B: Code Review & Optimization

1. **Scan**: Review code for `any` types, blocking operations, or non-modular coupling.
2. **Refactor**: Propose specific improvements (e.g. "Move this logic to a WASM module for
   performance").
3. **Test**: Generate unit test stubs (Jest/Vitest) for critical paths.
4. **Commit**: Prepare a commit message following Conventional Commits (`feat:`, `fix:`,
   `refactor:`).

## Workflow C: Deployment Protocol

1. **Pre-flight**:
   - Verify `CLOUDFLARE_API_TOKEN` is set.
   - Verify working directory is `~/sircollins-portal`.
   - Run `npm run lint` and `npm run build`.
2. **Deploy**:
   - Execute `npx wrangler pages deploy src/frontend --project-name=sircollins-pwa`.
3. **Post-deploy**:
   - Verify `sircollins.concept1.net` resolves.
   - Check Service Worker registration.
   - Validate JSON-LD output via `curl` or browser dev tools.

## Workflow D: "Inspirations & Reflections" Content Update

1. **Input**: Receive raw text/media from Sir Collins.
2. **Process**:
   - Convert to structured JSON-LD.
   - Compress to CBOR-LD for internal storage.
   - Generate a visual teaser card (CSS/SVG).
3. **Output**: Update `src/data/teasers.json` and trigger a hot-reload simulation.
4. **Notify**: "Content ingested. Teaser active on sircollins.concept1.net."

## Optional Emergency Protocol: "Build Again"

If a release fails any acceptance criterion:

1. **HALT** deployment immediately.
2. **Isolate** the failing component.
3. **Revert** to the last known stable commit.
4. **Diagnose** root cause (Logic, Syntax, or Architecture).
5. **Rebuild** with corrected logic before retrying.
