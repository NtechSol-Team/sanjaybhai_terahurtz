import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Loader2,
    Search,
    UserPlus,
    Users,
    CreditCard,
    ArrowUpRight,
    HandCoins,
} from "lucide-react";
import type { ReferrerStats } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function ReferralsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
    const [selectedReferrer, setSelectedReferrer] = useState<ReferrerStats | null>(null);
    const [payoutAmount, setPayoutAmount] = useState("");

    const [formData, setFormData] = useState({ name: "", phone: "", isPatient: false });
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: referrers, isLoading } = useQuery<ReferrerStats[]>({
        queryKey: ["/api/referrers"],
    });

    const createReferrerMutation = useMutation({
        mutationFn: async (data: { name: string; phone?: string; isPatient: boolean }) => {
            const res = await fetch("/api/referrers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(err.error || "Failed to create referrer");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/referrers"] });
            setAddDialogOpen(false);
            setFormData({ name: "", phone: "", isPatient: false });
            toast({ title: "Referrer added successfully" });
        },
        onError: (err: Error) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        },
    });

    const payoutMutation = useMutation({
        mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
            const res = await fetch(`/api/referrers/${id}/payout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: "Unknown error" }));
                throw new Error(err.error || "Failed to process payout");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/referrers"] });
            setPayoutDialogOpen(false);
            setPayoutAmount("");
            setSelectedReferrer(null);
            toast({ title: "Payout recorded successfully" });
        },
        onError: (err: Error) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        },
    });

    const handleSubmitAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;
        createReferrerMutation.mutate({
            name: formData.name.trim(),
            phone: formData.phone.trim() || undefined,
            isPatient: formData.isPatient,
        });
    };

    const handlePayoutSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReferrer || !payoutAmount) return;
        const amount = parseFloat(payoutAmount);
        if (isNaN(amount) || amount <= 0) return;

        payoutMutation.mutate({
            id: selectedReferrer.id,
            amount: amount,
        });
    };

    const filteredReferrers = referrers?.filter(referrer =>
        referrer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        referrer.phone?.includes(searchTerm)
    );

    const totalCreditEarned = referrers?.reduce((sum, r) => sum + (r.totalCreditEarned || 0), 0) || 0;
    const totalAvailableCredit = referrers?.reduce((sum, r) => sum + (r.availableCredit || 0), 0) || 0;
    const totalReferrals = referrers?.reduce((sum, r) => sum + (r.totalReferrals || 0), 0) || 0;

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Referral Management</h1>
                    <p className="text-muted-foreground">
                        Track referrers, referred patients, and credit status
                    </p>
                </div>

                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <UserPlus className="h-4 w-4" />
                            Add Referrer
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add New Referrer</DialogTitle>
                            <DialogDescription>
                                Add a therapist, patient, or any person who refers patients to your clinic.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmitAdd}>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="referrer-name">Name *</Label>
                                    <Input
                                        id="referrer-name"
                                        placeholder="e.g. Therapist Sharma"
                                        value={formData.name}
                                        onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="referrer-phone">Phone (optional)</Label>
                                    <Input
                                        id="referrer-phone"
                                        placeholder="e.g. 9876543210"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Referrer Type</Label>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant={!formData.isPatient ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setFormData(p => ({ ...p, isPatient: false }))}
                                        >
                                            External (Therapist/Other)
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={formData.isPatient ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setFormData(p => ({ ...p, isPatient: true }))}
                                        >
                                            Patient
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setAddDialogOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={createReferrerMutation.isPending || !formData.name.trim()}
                                >
                                    {createReferrerMutation.isPending && (
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    )}
                                    Save Referrer
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Referrals
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalReferrals}</div>
                        <p className="text-xs text-muted-foreground">
                            Successful patient referrals
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Credit Earned
                        </CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalCreditEarned.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Lifetime earnings (5% of First Bill)
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Available Credit
                        </CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalAvailableCredit.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Current outstanding balance
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <CardTitle>Referrers List</CardTitle>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search referrers..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead className="text-right">Total Patients</TableHead>
                                    <TableHead className="text-right">Total Earned</TableHead>
                                    <TableHead className="text-right">Available Credit</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading referrers...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredReferrers && filteredReferrers.length > 0 ? (
                                    filteredReferrers.map((referrer) => (
                                        <TableRow key={referrer.id}>
                                            <TableCell className="font-medium">
                                                {referrer.name}
                                                {referrer.patientId && (
                                                    <div className="text-xs text-muted-foreground">
                                                        Patient ID: {referrer.patientId}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={referrer.isPatient ? "default" : "secondary"}>
                                                    {referrer.isPatient ? "Patient" : "External"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{referrer.phone || "–"}</TableCell>
                                            <TableCell className="text-right">{referrer.totalReferrals}</TableCell>
                                            <TableCell className="text-right text-green-600 font-medium">
                                                ₹{referrer.totalCreditEarned?.toLocaleString() || 0}
                                            </TableCell>
                                            <TableCell className="text-right font-bold">
                                                ₹{referrer.availableCredit?.toLocaleString() || 0}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    disabled={referrer.availableCredit <= 0}
                                                    onClick={() => {
                                                        setSelectedReferrer(referrer);
                                                        setPayoutDialogOpen(true);
                                                    }}
                                                >
                                                    <HandCoins className="h-4 w-4" />
                                                    Payout
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                                <Users className="h-8 w-8 opacity-40" />
                                                <div>
                                                    <p className="font-medium">No referrers yet</p>
                                                    <p className="text-sm">Click <strong>Add Referrer</strong> above to get started.</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Payout Dialog */}
            <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Record Referrer Payout</DialogTitle>
                        <DialogDescription>
                            Enter the amount paid to <strong>{selectedReferrer?.name}</strong>. This will be deducted from their available credit.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handlePayoutSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="flex justify-between items-center p-3 bg-muted rounded-md mb-2">
                                <span className="text-sm font-medium">Current Available Credit:</span>
                                <span className="text-lg font-bold text-green-600">₹{selectedReferrer?.availableCredit.toLocaleString()}</span>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="payout-amount">Amount Paid (₹) *</Label>
                                <Input
                                    id="payout-amount"
                                    type="number"
                                    placeholder="Enter amount"
                                    value={payoutAmount}
                                    onChange={(e) => setPayoutAmount(e.target.value)}
                                    max={selectedReferrer?.availableCredit}
                                    min={1}
                                    required
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setPayoutDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={payoutMutation.isPending || !payoutAmount}
                            >
                                {payoutMutation.isPending && (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                )}
                                Confirm Payout
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
