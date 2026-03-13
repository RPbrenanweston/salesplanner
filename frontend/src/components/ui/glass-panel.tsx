import { cn } from "../../lib/utils";

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
