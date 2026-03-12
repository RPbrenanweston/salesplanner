/**
 * @crumb
 * @id jobtrackr-ui-glass-panel
 * @intent Render frosted glass surface using Frosted HUD design system CSS classes (glass-morphic aesthetic)
 * @responsibilities variant-to-class mapping (default/darker/card → glass-panel/glass-panel-darker/glass-card), className composition with cn(), children render
 * @contracts GlassPanelProps extends HTMLAttributes<HTMLDivElement> + variant? ("default" | "darker" | "card") + children (ReactNode); exports GlassPanel function component; renders <div> with className={cn(variantClasses[variant], "rounded-xl", className)}
 * @hazards glass-panel/glass-panel-darker/glass-card CSS classes MUST be defined in globals.css or Tailwind config — missing CSS renders unstyled div; variant-class mapping is object literal (not CVA) so TypeScript compile-time check required; rounded-xl hardcoded, may conflict with custom className
 * @area UI
 * @refs packages/ui/src/utils.ts, packages/ui/src/index.ts, globals.css (Frosted HUD design system)
 * @prompt Before using, verify glass-panel CSS classes exist in globals.css. For custom glass depths, add new variant with corresponding CSS class. Keep rounded-xl consistent across all variants (do not vary in className). Do not convert to CVA unless multiple styling axes emerge.
 */
import { cn } from "./utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "darker" | "card";
  children: React.ReactNode;
}

export function GlassPanel({
  variant = "default",
  className,
  children,
  ...props
}: GlassPanelProps) {
  const variantClasses = {
    default: "glass-panel",
    darker: "glass-panel-darker",
    card: "glass-card",
  };

  return (
    <div
      className={cn(variantClasses[variant], "rounded-xl", className)}
      {...props}
    >
      {children}
    </div>
  );
}
