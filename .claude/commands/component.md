Create a new React component in the mk12-dashboard.

Arguments: $ARGUMENTS should be the component name (e.g., `ProjectTimeline`, `SegmentCard`).

Steps:
1. Determine if this is a UI primitive (put in `src/components/ui/`) or a feature component (put in `src/components/` under an appropriate subdirectory)
2. Follow the existing patterns in mk12-dashboard:
   - Use TypeScript with proper prop types
   - Use Tailwind CSS 4 for styling with the `cn()` utility
   - Use shadcn/ui patterns for UI primitives
   - Export as named export
3. Create the component file
4. If it's a complex component, consider creating a separate types file or hook
