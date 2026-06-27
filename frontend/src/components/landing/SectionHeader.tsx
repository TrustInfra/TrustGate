import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  lede?: string;
  align?: "left" | "center";
  className?: string;
}

export default function SectionHeader({
  eyebrow,
  title,
  lede,
  align = "left",
  className,
}: SectionHeaderProps) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";

  return (
    <header
      className={cn(
        "max-w-2xl mb-12 lg:mb-16",
        alignClass,
        className
      )}
    >
      <p className="text-[10px] font-mono font-medium text-accent uppercase tracking-[0.22em] mb-4">
        {eyebrow}
      </p>
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-text tracking-tight leading-tight">
        {title}
      </h2>
      {lede && (
        <p className="mt-4 text-sm text-text-secondary leading-relaxed max-w-xl">
          {lede}
        </p>
      )}
    </header>
  );
}