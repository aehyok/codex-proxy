## 2026-03-03 - Accessibility & Keyboard Navigation Polish
**Learning:** Icon-only buttons and elements that rely solely on hover visibility (like copy buttons in code blocks) are invisible to screen readers and keyboard-only users. Consistent use of 'aria-label' and 'focus-within' is essential for a truly inclusive experience.
**Action:** Always include 'aria-label' for icon buttons and ensure hover-based UI elements use 'group-focus-within' to become visible on focus. Implement 'focus-visible' rings for all interactive elements to aid keyboard navigation.
