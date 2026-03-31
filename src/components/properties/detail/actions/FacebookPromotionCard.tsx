'use client';
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook, ExternalLink, Rocket, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import Link from 'next/link';
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useAgency } from "@/context/AgencyContext";
import { useFirestore, updateDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

const defaultFacebookGroups = [
    "https://www.facebook.com/groups/proprietardirect/",
    "https://www.facebook.com/groups/direct.proprietar.bucuresti",
    "https://www.facebook.com/groups/1641351206103083/",
    "https://www.facebook.com/groups/258889259180994/",
    "https://www.facebook.com/groups/1730657617186760/",
    "https://www.facebook.com/groups/713711863981114/",
    "https://www.facebook.com/groups/118204592204043/",
    "https://www.facebook.com/groups/358979851113612/",
    "https://www.facebook.com/groups/3188029944804073/",
    "https://www.facebook.com/groups/5730550950403049/",
    "https://www.facebook.com/groups/269598638382777/",
    "https://www.facebook.com/groups/imobiliare.particulari/"
].map((url, index) => ({
    name: `Grup Facebook ${index + 1}`,
    url,
}));

export function FacebookPromotionCard() {
    const isMobile = useIsMobile();
    const { agency, agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [groupsDraft, setGroupsDraft] = useState<{ name: string; url: string }[]>(agency?.facebookGroups?.length ? agency.facebookGroups : defaultFacebookGroups);

    useEffect(() => {
        setGroupsDraft(agency?.facebookGroups?.length ? agency.facebookGroups : defaultFacebookGroups);
    }, [agency?.facebookGroups]);

    const handleGroupChange = (index: number, field: 'name' | 'url', value: string) => {
        setGroupsDraft((current) =>
            current.map((group, currentIndex) =>
                currentIndex === index ? { ...group, [field]: value } : group
            )
        );
    };

    const handleAddGroup = () => {
        setGroupsDraft((current) => [...current, { name: '', url: '' }]);
    };

    const handleRemoveGroup = (index: number) => {
        setGroupsDraft((current) => current.filter((_, currentIndex) => currentIndex !== index));
    };

    const handleSaveGroups = async () => {
        if (!agencyId) return;

        const sanitizedGroups = groupsDraft
            .map((group) => ({
                name: group.name.trim(),
                url: group.url.trim(),
            }))
            .filter((group) => group.name && group.url);

        setIsSaving(true);
        try {
            const agencyRef = doc(firestore, 'agencies', agencyId);
            updateDocumentNonBlocking(agencyRef, { facebookGroups: sanitizedGroups });
            toast({ title: 'Grupurile au fost salvate.' });
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save facebook groups', error);
            toast({
                variant: 'destructive',
                title: 'Salvare eșuată',
                description: 'Nu am putut salva grupurile Facebook.',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                 <Card
                    className={cn(
                        "overflow-hidden rounded-2xl border border-emerald-300/14 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.1),transparent_34%),linear-gradient(180deg,#18304f_0%,#152A47_58%,#12233b_100%)] p-0 cursor-pointer text-white transition-colors shadow-[0_24px_70px_-36px_rgba(0,0,0,0.72)] hover:bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.13),transparent_34%),linear-gradient(180deg,#1b3558_0%,#162c4b_58%,#13253e_100%)]"
                    )}
                 >
                    <CardContent className="p-2 flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex items-center justify-center rounded-full",
                                "h-10 w-10 border border-emerald-300/16 bg-emerald-400/10 text-emerald-200"
                            )}>
                                <Facebook className="h-4 w-4 text-emerald-200" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-base font-semibold text-white">
                                    Grupurile tale Facebook
                                </p>
                                <p className="text-xs text-white/60">
                                    Publica rapid anuntul in grupurile tale relevante.
                                </p>
                            </div>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/16 bg-emerald-400/10 text-emerald-200">
                            <Rocket className="h-4 w-4 text-emerald-200" />
                        </div>
                    </CardContent>
                </Card>
            </DialogTrigger>
            <DialogContent className={cn(
                "sm:max-w-md bg-[#0F1E33] text-white",
                isMobile && "h-screen w-screen max-w-full rounded-none border-none flex flex-col p-0"
            )}>
                <DialogHeader className={cn(
                    "p-6",
                    isMobile && "p-4 border-b border-white/10 text-center shrink-0"
                )}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <DialogTitle className="text-left text-xl font-semibold text-white">
                                Grupurile tale Facebook
                            </DialogTitle>
                            <DialogDescription className="text-left text-sm leading-6 text-white/65">
                                Deschide rapid grupurile relevante și distribuie anunțul acolo unde ai deja audiență potrivită.
                            </DialogDescription>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-10 w-10 shrink-0 rounded-full border border-emerald-300/16 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/14 hover:text-emerald-100",
                                isMobile && "mr-10"
                            )}
                            onClick={() => setIsEditing((current) => !current)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>
                <div className={cn(isMobile ? "flex-1 overflow-y-auto" : "max-h-80 overflow-y-auto pr-4")}>
                    <div className={cn("space-y-3", isMobile ? "p-4" : "")}>
                        {isEditing ? (
                            <div className="space-y-3 rounded-2xl border border-emerald-300/12 bg-white/[0.03] p-4">
                                {groupsDraft.map((group, index) => (
                                    <div key={`${index}-${group.url}`} className="grid gap-3 rounded-xl border border-white/8 bg-[#10233b] p-3">
                                        <Input
                                            value={group.name}
                                            onChange={(event) => handleGroupChange(index, 'name', event.target.value)}
                                            placeholder="Denumire grup"
                                            className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/35"
                                        />
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={group.url}
                                                onChange={(event) => handleGroupChange(index, 'url', event.target.value)}
                                                placeholder="Link grup Facebook"
                                                className="border-white/12 bg-white/[0.04] text-white placeholder:text-white/35"
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 shrink-0 rounded-full border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                                                onClick={() => handleRemoveGroup(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="rounded-full border border-emerald-300/16 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/14 hover:text-emerald-100"
                                        onClick={handleAddGroup}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Adauga grup
                                    </Button>
                                    <Button
                                        type="button"
                                        className="rounded-full"
                                        onClick={handleSaveGroups}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Salveaza grupurile
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                        {!isEditing && (agency?.facebookGroups?.length ? agency.facebookGroups : defaultFacebookGroups).map((group, index) => (
                            <Button
                                asChild
                                key={`${group.url}-${index}`}
                                variant="outline"
                                className={cn(
                                    "h-auto w-full justify-between rounded-2xl border p-0 text-white shadow-none",
                                    "border-emerald-300/12 bg-white/[0.03] hover:bg-white/[0.05] hover:text-white"
                                )}
                            >
                                <Link
                                    href={group.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white">{group.name || `Grup Facebook ${index + 1}`}</p>
                                        <p className="mt-1 truncate text-xs text-white/55">
                                            Deschide grupul si publica anuntul direct.
                                        </p>
                                    </div>
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-emerald-300/16 bg-emerald-400/10 text-emerald-200">
                                        <ExternalLink className="h-4 w-4" />
                                    </div>
                                </Link>
                            </Button>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
