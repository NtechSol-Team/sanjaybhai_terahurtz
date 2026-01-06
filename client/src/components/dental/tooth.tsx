import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ToothProps {
    id: number;
    label: string;
    condition?: string;
    selected?: boolean;
    onClick?: () => void;
    className?: string;
}

const CONDITION_COLORS: Record<string, string> = {
    Healthy: "fill-green-100 stroke-green-600",
    Caries: "fill-yellow-100 stroke-yellow-600",
    Missing: "fill-gray-100 stroke-gray-400 opacity-50",
    Filled: "fill-blue-100 stroke-blue-600",
    Crown: "fill-purple-100 stroke-purple-600",
    RootCanal: "fill-red-100 stroke-red-600",
};

export function Tooth({ id, label, condition = "Healthy", selected, onClick, className }: ToothProps) {
    const colorClass = CONDITION_COLORS[condition] || CONDITION_COLORS.Healthy;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={onClick}
                    className={cn(
                        "relative flex flex-col items-center justify-center p-2 transition-transform hover:scale-110 focus:outline-none",
                        selected && "scale-110 ring-2 ring-primary rounded-lg",
                        className
                    )}
                >
                    <span className="text-xs font-medium text-muted-foreground mb-1">{label}</span>
                    <svg
                        viewBox="0 0 100 100"
                        className={cn("w-12 h-12 transition-colors", colorClass)}
                        strokeWidth="4"
                    >
                        {/* Simple Molar Shape */}
                        <path d="M20,35 Q20,10 50,10 Q80,10 80,35 Q85,60 75,85 Q65,100 50,90 Q35,100 25,85 Q15,60 20,35 Z" />

                        {/* Root Definition (Visual enhancement) */}
                        <path d="M35,60 Q50,70 65,60" fill="none" className="stroke-current opacity-30" />
                    </svg>
                    {condition !== "Healthy" && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                            !
                        </span>
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent>
                <p className="font-semibold">Tooth {id}</p>
                <p className="text-sm text-muted-foreground">{condition}</p>
            </TooltipContent>
        </Tooltip>
    );
}
