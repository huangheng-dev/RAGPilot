import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricSummaryCardProps = {
  accentClassName?: string;
  description: string;
  label: string;
  value: number;
};

export function MetricSummaryCard({ accentClassName, description, label, value }: MetricSummaryCardProps) {
  return (
    <Card className={cn("border-slate-200 shadow-sm", accentClassName)}>
      <CardHeader className="pb-3">
        <CardDescription className={cn("text-xs uppercase tracking-[0.16em]", accentClassName ? "text-inherit" : undefined)}>
          {label}
        </CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
