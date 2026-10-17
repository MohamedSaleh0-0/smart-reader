# Smart Reader v2 — rebuild programme

**Status:** v2 implementation is underway in `v2/`. The first release is a reader and citation workflow; the earlier book-note proposal has been deferred.

The present application is a valuable working prototype, but it is not the v2 architecture. It remains available as a behavioural reference until the replacement has passed its acceptance criteria.

## How phases 0–2 run

The phases overlap deliberately, with a strict direction of dependency:

1. **Phase 0 — prototype discovery:** collect evidence about current behaviour, data, limits, and real user findings.
2. **Phase 1 — product definition:** turn that evidence into a deliberately scoped product promise and release boundaries.
3. **Phase 2 — domain design:** model the stable concepts the application must protect before choosing screens or implementation details.

Phase 1 and Phase 2 documents may contain proposals while discovery continues. A proposal becomes a decision only after it is explicitly accepted by the project decision group.

## Current deliverables

| Phase | Deliverable | State |
|---|---|---|
| 0 | [Prototype inventory](00-prototype-inventory.md) | Initial baseline complete; feature verification continues |
| 1 | [Product brief](01-product-brief.md) | Updated reader-first scope; public release still needs group approval |
| 2 | [Domain model](02-domain-model.md) | Draft requiring technical review |
| Foundation specification | [First vertical slice](03-first-vertical-slice.md) | Reader → passage → citation workflow |
| Delivery | [Foundation delivery plan](04-foundation-delivery-plan.md) | Fixtures and Markdown prototype implemented; HTML/DOCX and browser verification remain |
| Link format | [Source-reference contract](05-source-reference-contract.md) | Initial contract drafted |
| Architecture | [Foundation architecture decision](06-architecture-decision.md) | Provisional; dependency-free contract spike passes |

## Working rules

- Keep the prototype intact as a reference while v2 is designed and built.
- Do not copy a feature solely because it exists in v1; classify it as **keep**, **redesign**, **defer**, or **remove**.
- Every v2 feature needs a user outcome, acceptance criteria, and a data-model home.
- Preserve the prototype's successful reader typography, pages, pagination, and heading decorations while keeping v2's code independently structured.
- Separate physical source pages, printed page labels, reader locations, and passages. They are not interchangeable.
- Advanced features must degrade honestly: for example, a scanned PDF without OCR may support page navigation but not exact-text search.

## Shared terms

- **Vertical slice:** one narrow but complete user journey that crosses the real application layers. The current slice is: import a structured book → read/navigate → select a passage → copy text/citation/local link → reopen the link at the passage. Book notes are deferred.
- **Redesign:** retain the useful user outcome while implementing its data model, interface, and tests afresh. It does not mean copying the prototype’s code or UI.
- **Fidelity:** how faithfully an import preserves the source information that matters to the user. For an OCR book, this means page boundaries, blank pages, headings, footnote relationships, and text order—not merely that all recognised words still appear somewhere.
- **Browser-native prompt/confirm:** the browser’s built-in `window.prompt()` or `window.confirm()` dialog. It uses browser wording and appearance (for example, “This page says”), cannot follow the application’s RTL/accessibility design, and interrupts the reading flow.

## Immediate next work

1. Run the automated tests/build for the current Markdown reader and inspect the pages in a browser.
2. Verify page/citation/deep-link behavior with a real Arabic book in a clean browser profile.
3. Implement and verify the HTML adapter, then the DOCX adapter, against the shared model.
4. Complete image packaging, mobile/accessibility review, and the release acceptance gate in [plan.md](../../plan.md).
