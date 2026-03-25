# CSS Organization Guide

This guide documents how styling is organized and best practices for CSS in the SalesBlock.io frontend.

## Architecture: Tailwind CSS

**SalesBlock.io uses Tailwind CSS for all styling** - a utility-first CSS framework that keeps styles inline with components.

### Why Tailwind CSS?

1. **Utility-first**: Use pre-built utility classes instead of writing custom CSS
2. **Small bundle**: Only includes CSS classes that are actually used in code
3. **Dark mode support**: Built-in dark mode with `dark:` prefix
4. **Responsive design**: Mobile-first responsive utilities (sm:, md:, lg:, etc.)
5. **No naming conflicts**: No need to invent class names or worry about collisions
6. **Easy to maintain**: Styles are next to the HTML they style

---

## File Organization

### Single CSS Entry Point

```
frontend/src/index.css
```

This is the **only** CSS file in the project. It imports Tailwind's three layers:

```css
@tailwind base;        /* Reset/normalize styles */
@tailwind components;  /* Component-level classes */
@tailwind utilities;   /* Utility-first classes */
```

### No Per-Component CSS Files

**Don't create** separate `.css` or `.module.css` files for components.

❌ **Bad**: Component with separate CSS file
```
components/
├── MyComponent.tsx
├── MyComponent.css
```

✅ **Good**: Styles inline with component
```
components/
└── MyComponent.tsx  (styles inside className)
```

---

## Tailwind CSS Pattern

### Inline Utility Classes in Components

All styling is done through Tailwind's utility classes directly in the `className` prop.

```typescript
// ✅ Good - Using Tailwind utilities
<div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
    Title
  </h1>
  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
    Click me
  </button>
</div>

// ❌ Bad - Custom CSS
<style>
  .mycard { background: white; border-radius: 0.5rem; }
</style>
<div className="mycard">

// ❌ Bad - Inline styles
<div style={{ backgroundColor: 'white', borderRadius: '0.5rem' }}>
```

### Structuring Long ClassNames

When `className` becomes long, break it into multiple lines for readability:

```typescript
<div
  className={`
    bg-white dark:bg-gray-800
    rounded-lg
    border border-gray-200 dark:border-gray-700
    p-6
    shadow-sm
  `}
>
  {/* content */}
</div>

// Or using template literals for logic:
<div
  className={`
    flex items-center justify-between
    ${isActive ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}
    p-4 rounded
  `}
>
  {/* content */}
</div>
```

---

## Dark Mode

### Pattern: Use `dark:` Prefix

Tailwind's `dark:` prefix applies classes in dark mode.

```typescript
// Default (light mode) | Dark mode
className="
  bg-white              dark:bg-gray-800
  text-gray-900         dark:text-white
  border-gray-200       dark:border-gray-700
  hover:bg-gray-50      dark:hover:bg-gray-700
"
```

### How Dark Mode Works

The theme is managed by the `useTheme()` hook:

```typescript
// components/AppLayout.tsx
const { theme } = useTheme()
// theme can be: 'system', 'light', 'dark'
```

Dark mode is applied to the `html` root element:
- When `theme === 'dark'`: `<html class="dark">`
- When `theme === 'light'`: `<html>` (no class)
- When `theme === 'system'`: Uses OS preference `prefers-color-scheme`

Tailwind's `dark:` prefix matches the `.dark` class on the root element.

### Common Dark Mode Pattern

```typescript
<div className="
  bg-white dark:bg-gray-800           // Background
  text-gray-900 dark:text-white       // Text color
  border-gray-200 dark:border-gray-700  // Borders
  shadow-lg dark:shadow-gray-700      // Shadows
  hover:bg-gray-50 dark:hover:bg-gray-700  // Hover states
  focus:ring-2 dark:focus:ring-blue-500  // Focus states
">
  Content
</div>
```

---

## Responsive Design

### Mobile-First Approach

Use responsive prefixes for mobile-first design. Default styles apply to mobile, then override with breakpoints.

```typescript
// Default (mobile) | Tablet | Desktop
className="
  text-sm              md:text-base      lg:text-lg        // Font size
  grid-cols-1          md:grid-cols-2    lg:grid-cols-3    // Grid columns
  p-4                  md:p-6            lg:p-8            // Padding
  flex-col             md:flex-row                          // Flex direction
"
```

### Breakpoints

```
sm: 640px  (small devices)
md: 768px  (tablets)
lg: 1024px (desktop)
xl: 1280px (large desktop)
2xl: 1536px (extra large)
```

### Common Responsive Patterns

```typescript
// Responsive grid
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"

// Responsive padding
className="p-4 md:p-6 lg:p-8"

// Responsive text size
className="text-sm md:text-base lg:text-lg"

// Hide/show on breakpoints
className="hidden lg:block"  // Hide on mobile/tablet, show on desktop

// Responsive flexbox
className="flex flex-col md:flex-row gap-4"
```

---

## Common Tailwind Patterns

### Buttons

```typescript
// Primary button
<button className="
  bg-blue-600 hover:bg-blue-700
  text-white
  px-4 py-2
  rounded
  font-medium
  focus:ring-2 focus:ring-blue-500 focus:outline-none
">
  Click me
</button>

// Secondary button
<button className="
  bg-gray-200 dark:bg-gray-700
  text-gray-900 dark:text-white
  hover:bg-gray-300 dark:hover:bg-gray-600
  px-4 py-2
  rounded
">
  Cancel
</button>
```

### Cards

```typescript
<div className="
  bg-white dark:bg-gray-800
  rounded-lg
  border border-gray-200 dark:border-gray-700
  shadow-sm
  p-6
">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
    Card Title
  </h3>
  <p className="text-gray-600 dark:text-gray-400">
    Card content
  </p>
</div>
```

### Modals/Dialogs

```typescript
<div className="
  fixed inset-0
  bg-black bg-opacity-50
  flex items-center justify-center
  z-50
">
  <div className="
    bg-white dark:bg-gray-800
    rounded-lg
    shadow-lg
    p-6
    max-w-md w-full mx-4
  ">
    {/* Modal content */}
  </div>
</div>
```

### Forms

```typescript
<input
  type="text"
  placeholder="Enter text..."
  className="
    w-full
    px-4 py-2
    border border-gray-300 dark:border-gray-600
    rounded-md
    bg-white dark:bg-gray-700
    text-gray-900 dark:text-white
    placeholder-gray-500 dark:placeholder-gray-400
    focus:ring-2 focus:ring-blue-500 focus:border-transparent
    focus:outline-none
  "
/>
```

### Lists

```typescript
<ul className="divide-y divide-gray-200 dark:divide-gray-700">
  {items.map(item => (
    <li key={item.id} className="py-4 px-4 hover:bg-gray-50 dark:hover:bg-gray-700">
      <p className="text-gray-900 dark:text-white">{item.name}</p>
    </li>
  ))}
</ul>
```

---

## Accessibility with Tailwind

### Focus States

```typescript
className="
  focus:ring-2 focus:ring-blue-500 focus:outline-none
  focus:ring-offset-2 dark:focus:ring-offset-gray-900
"
```

### Disabled States

```typescript
className="
  disabled:opacity-50
  disabled:cursor-not-allowed
  disabled:bg-gray-200
"
```

### Screen Reader Only

```typescript
// Hidden visually but accessible to screen readers
<span className="sr-only">Required field</span>
```

### Color Contrast

Tailwind's default color palette has accessible contrast ratios. For dark mode, use properly contrasted colors:

```typescript
// Good contrast in dark mode
className="
  text-gray-300 dark:text-gray-100  // Light text on dark background
  text-gray-700 dark:text-gray-200  // Slightly darker text
"

// Avoid low contrast:
className="text-gray-400 dark:text-gray-600"  // ❌ Low contrast in dark mode
```

---

## Configuration

### Tailwind Config

Located in: `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Custom colors
      colors: {
        'brand-blue': '#0066cc',
      },
      // Custom spacing
      spacing: {
        '7.5': '1.875rem',
      },
    },
  },
  plugins: [],
}
```

### PostCSS Config

Located in: `postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

---

## Performance

### Bundle Size

Tailwind only includes CSS for classes used in the code. The build process:

1. Scans all files for class names
2. Generates CSS only for found classes
3. Minifies and optimizes output

**Result**: Small CSS bundle (typically 10-50 KB)

### Best Practices for Performance

1. ✅ Use utility classes (they're already optimized)
2. ✅ Extract repeated class combinations into variables (if needed)
3. ❌ Don't write custom CSS in index.css
4. ❌ Don't use CSS-in-JS libraries alongside Tailwind

---

## Troubleshooting

### Class isn't applying?

1. **Check spelling**: `bg-blue-600` not `bg-blue600`
2. **Check prefix**: `dark:bg-gray-800` for dark mode
3. **Check breakpoint**: `md:text-base` for tablets
4. **Run build**: CSS is generated during build
5. **Check specificity**: Tailwind classes should have high specificity

### Dark mode not working?

1. Verify `theme === 'dark'` or OS preference is dark mode
2. Check that `useTheme()` is initialized
3. Verify `dark:` prefix is used in classNames
4. Check browser DevTools to see if `.dark` class is on `<html>`

### Style not responsive?

1. Mobile-first: default styles apply to all sizes
2. Use `md:`, `lg:`, etc. to override at breakpoints
3. Remember: `sm:` is 640px and up, not "exactly small"
4. Use DevTools to check actual viewport size

---

## Summary

| Aspect | Solution |
|--------|----------|
| Where to write styles | In `className` prop with Tailwind utilities |
| Dark mode | Use `dark:` prefix for dark mode styles |
| Responsive | Use `sm:`, `md:`, `lg:` prefixes for breakpoints |
| CSS files | Only `src/index.css` - imports Tailwind |
| Custom styles | Rarely needed - use Tailwind utilities instead |
| Configuration | `tailwind.config.js` for customization |
| Accessibility | Use focus:, disabled:, sr-only utilities |

