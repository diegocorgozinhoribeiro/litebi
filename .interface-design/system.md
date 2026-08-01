# LiteBI Interface System

## Direction

- Feel: analytical, calm, trustworthy, and compact without looking crowded.
- Product signature: blue-to-turquoise LiteBI identity combined with restrained neutral data surfaces.
- Preserve hierarchy through spacing, weight, and subtle tonal changes; reserve brand color for actions, identity, and data emphasis.

## Foundations

- Spacing base: 4px, composed mainly in 8px increments.
- Depth: subtle shadows in light mode; borders and surface shifts in dark mode.
- Radius: controls 8–10px, cards 14–18px, modals 16–18px.
- Typography: compact dashboard scale with strong values, medium labels, and muted metadata.
- Interactive targets: 44px whenever practical, with visible focus states.

## Exported and Published Report Tables

- The table title remains in the card header as a stable reference.
- Header, rows, and scrollbars belong to one `.table-scroll` container.
- `.cell-body.table-body` has no padding and hides overflow; `.table-scroll` owns horizontal and vertical scrolling.
- Table headers are not sticky: `th { position: static; }`. Header and rows must scroll together to avoid detached bars.
- Tables use `width: 100%` and `min-width: max-content` so narrow cards gain horizontal scrolling without crushing columns.
- Use `overscroll-behavior: contain` and `scrollbar-gutter: stable` to avoid page-scroll chaining and layout jumps.
- Mobile keeps the same behavior and must not restore padding on `.table-body`.
- The public dashboard response applies a compatibility override to previously stored HTML, so old published reports follow the corrected scrolling behavior after deployment.

## Multi-page Analytical Reports

- A report supports 1–8 topic-based pages; one “Visão geral” page is the default and legacy migration target.
- Tabs are a compact horizontal navigation surface, scrollable on narrow screens, with 38–40px controls and visible selected, hover, and focus states.
- The editor and exported/published report share the same page order and names.
- Components belong to exactly one `pageId`; filters and the source dataset remain global.
- Each AI-generated page targets one distinct analytical subject and contains a coherent set of KPIs, charts, and a detail table.
- Business-facing labels must interpret technical column names and descriptions. Never expose mechanical titles such as “Total home_goals”; prefer “Total de gols do mandante”.
- Before AI generation, page quantity is managed directly through a vertical page composer: one card per page, editable name, visible index, count badge, add action, and delete action. Do not use a detached quantity select.
- In the manual editor, page management stays inside the tab bar: inline rename, confirmed deletion, and “Nova aba” up to the eight-page limit. Avoid browser prompts for naming.
- Intake modals own vertical scrolling. Nested data previews may scroll horizontally but must not capture vertical wheel input from the modal.
