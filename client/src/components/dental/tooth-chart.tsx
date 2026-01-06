import { Tooth } from "./tooth";
import { type ToothRecord } from "@shared/schema";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ToothChartProps {
    records?: ToothRecord[];
    selectedTeeth?: number[];
    onToothClick?: (toothNumber: number) => void;
    className?: string;
}

export function ToothChart({ records = [], selectedTeeth = [], onToothClick, className }: ToothChartProps) {
    const getCondition = (toothNumber: number) => {
        return records.find((r) => r.toothNumber === toothNumber)?.condition;
    };

    const renderQuadrant = (teeth: number[], title: string) => (
        <div className="flex flex-col gap-2 p-4 bg-muted/20 rounded-lg">
            <h4 className="text-sm font-semibold text-center text-muted-foreground uppercase">{title}</h4>
            <div className="flex justify-center gap-1 sm:gap-2 flex-wrap">
                {teeth.map((id) => (
                    <Tooth
                        key={id}
                        id={id}
                        label={id.toString()}
                        condition={getCondition(id)}
                        selected={selectedTeeth.includes(id)}
                        onClick={() => onToothClick?.(id)}
                    />
                ))}
            </div>
        </div>
    );

    // FDI Notation Arrays
    const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
    const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28];

    // Lower teeth often displayed mirrored to match upper visually (Patient Right on Left side)
    const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
    const lowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];

    return (
        <Card className={className}>
            <CardHeader className="pb-2">
                <CardTitle className="text-center">Dental Chart (Adult - FDI)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 max-w-4xl mx-auto">
                    {/* Upper Arch */}
                    <div className="space-y-4 md:contents">
                        <div className="flex flex-col gap-4">
                            {renderQuadrant(upperRight, "Upper Right")}
                        </div>
                        <div className="flex flex-col gap-4">
                            {renderQuadrant(upperLeft, "Upper Left")}
                        </div>
                    </div>

                    {/* Horizontal divider for visual separation */}
                    <div className="hidden md:block col-span-2 border-t border-dashed border-gray-300 my-2 relative">
                        <span className="absolute left-1/2 -top-3 -translate-x-1/2 bg-background px-2 text-xs text-muted-foreground">MIDLINE</span>
                    </div>

                    {/* Lower Arch */}
                    <div className="space-y-4 md:contents">
                        <div className="flex flex-col gap-4">
                            {renderQuadrant(lowerRight, "Lower Right")}
                        </div>
                        <div className="flex flex-col gap-4">
                            {renderQuadrant(lowerLeft, "Lower Left")}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs">
                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 border border-green-600"></span> Healthy</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-100 border border-yellow-600"></span> Caries</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-600"></span> Filled</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-100 border border-purple-600"></span> Crown</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-100 border border-red-600"></span> RCT</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-100 border border-gray-400"></span> Missing</div>
                </div>
            </CardContent>
        </Card>
    );
}
