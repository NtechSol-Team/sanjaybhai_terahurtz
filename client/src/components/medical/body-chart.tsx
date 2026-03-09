import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface BodyPartProps {
    id: string;
    d: string;
    name: string;
    selected?: boolean;
    injured?: boolean;
    onClick: (id: string) => void;
}

const BodyPart = ({ id, d, name, selected, injured, onClick }: BodyPartProps) => {
    return (
        <g onClick={() => onClick(id)} className="cursor-pointer group">
            <path
                d={d}
                fill={selected ? "hsl(var(--primary))" : injured ? "hsl(var(--destructive))" : "hsl(var(--muted))"}
                className={cn(
                    "transition-colors duration-200 stroke-border stroke-[2px]",
                    "group-hover:fill-primary/50"
                )}
            />
            <title>{name}</title>
        </g>
    );
};

interface BodyChartProps {
    selectedPart?: string | null;
    onPartSelect: (part: string) => void;
    injuries?: { bodyPart: string; painLevel: number }[];
    className?: string;
}

export function BodyChart({ selectedPart, onPartSelect, injuries = [], className }: BodyChartProps) {
    const [view, setView] = useState<"front" | "back">("front");

    const injuredParts = new Set(injuries.map(i => i.bodyPart));

    // Simplified paths for body parts - in a real app these would be detailed SVG paths
    const frontPaths = [
        { id: "Head", name: "Head", d: "M100 20 A 30 30 0 1 1 100 80 A 30 30 0 1 1 100 20" },
        { id: "Neck", name: "Neck", d: "M85 80 L115 80 L115 100 L85 100 Z" },
        { id: "Shoulders", name: "Shoulders", d: "M50 100 L150 100 L150 120 L50 120 Z" },
        { id: "Chest", name: "Chest", d: "M60 120 L140 120 L135 180 L65 180 Z" },
        { id: "Abdomen", name: "Abdomen", d: "M65 180 L135 180 L130 240 L70 240 Z" },
        { id: "Pelvis", name: "Pelvis", d: "M70 241 L130 241 L120 280 L80 280 Z" },
        { id: "LeftArm", name: "Left Arm", d: "M150 100 L180 120 L170 200 L140 180 Z" }, // Simplified
        { id: "RightArm", name: "Right Arm", d: "M50 100 L20 120 L30 200 L60 180 Z" },
        { id: "LeftForearm", name: "Left Forearm", d: "M170 201 L180 260 L160 270 L145 200 Z" },
        { id: "RightForearm", name: "Right Forearm", d: "M30 201 L20 260 L40 270 L55 200 Z" },
        { id: "LeftLeg", name: "Left Leg", d: "M120 280 L140 280 L130 400 L100 400 Z" }, // Thigh
        { id: "RightLeg", name: "Right Leg", d: "M80 280 L60 280 L70 400 L100 400 Z" },
        { id: "LeftShin", name: "Left Shin", d: "M100 401 L130 401 L125 520 L105 520 Z" },
        { id: "RightShin", name: "Right Shin", d: "M100 401 L70 401 L75 520 L95 520 Z" },
    ];

    const backPaths = [
        { id: "HeadBack", name: "Head (Back)", d: "M100 20 A 30 30 0 1 1 100 80 A 30 30 0 1 1 100 20" },
        { id: "NeckBack", name: "Neck", d: "M85 80 L115 80 L115 100 L85 100 Z" },
        { id: "UpperBack", name: "Upper Back", d: "M50 100 L150 100 L140 180 L60 180 Z" },
        { id: "LowerBack", name: "Lower Back", d: "M60 181 L140 181 L130 240 L70 240 Z" },
        { id: "Glutes", name: "Glutes", d: "M70 241 L130 241 L120 280 L80 280 Z" },
    ];

    const currentPaths = view === "front" ? frontPaths : backPaths;

    return (
        <div className={cn("flex flex-col items-center gap-4", className)}>
            <div className="flex gap-2">
                <Badge
                    variant={view === "front" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setView("front")}
                >
                    Front View
                </Badge>
                <Badge
                    variant={view === "back" ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setView("back")}
                >
                    Back View
                </Badge>
            </div>

            <svg
                viewBox="0 0 200 550"
                className="w-full h-[500px] border rounded-lg bg-slate-50 dark:bg-slate-900"
            >
                {currentPaths.map((part) => (
                    <BodyPart
                        key={part.id}
                        id={part.id}
                        name={part.name}
                        d={part.d}
                        selected={selectedPart === part.id}
                        injured={injuredParts.has(part.id)}
                        onClick={onPartSelect}
                    />
                ))}
            </svg>

            <div className="text-sm text-muted-foreground">
                Click on a body part to select
            </div>
        </div>
    );
}
