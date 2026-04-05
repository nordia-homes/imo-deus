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
import { defaultFacebookGroups, getAgencyFacebookGroups } from "@/lib/facebook-groups";
import { ACTION_CARD_INTERACTIVE_CLASSNAME, ACTION_CARD_INNER_CLASSNAME, ACTION_INPUT_CLASSNAME, ACTION_PILL_CLASSNAME } from "./cardStyles";

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
                        `${ACTION_CARD_INTERACTIVE_CLASSNAME} p-0 cursor-pointer`
                    )}
                 >
                    <CardContent className="p-2 flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex items-center justify-center rounded-full",
                                `h-10 w-10 ${ACTION_PILL_CLASSNAME}`
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
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${ACTION_PILL_CLASSNAME}`}>
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
                                `h-10 w-10 shrink-0 rounded-full ${ACTION_PILL_CLASSNAME}`,
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
                            <div className={cn("space-y-3 rounded-2xl p-4", ACTION_CARD_INNER_CLASSNAME)}>
                                {groupsDraft.map((group, index) => (
                                    <div key={`${index}-${group.url}`} className={cn("grid gap-3 rounded-xl p-3", ACTION_CARD_INNER_CLASSNAME)}>
                                        <Input
                                            value={group.name}
                                            onChange={(event) => handleGroupChange(index, 'name', event.target.value)}
                                            placeholder="Denumire grup"
                                            className={ACTION_INPUT_CLASSNAME}
                                        />
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={group.url}
                                                onChange={(event) => handleGroupChange(index, 'url', event.target.value)}
                                                placeholder="Link grup Facebook"
                                                className={ACTION_INPUT_CLASSNAME}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 shrink-0 rounded-full border border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
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
                                        className={`rounded-full ${ACTION_PILL_CLASSNAME}`}
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
                        {!isEditing && getAgencyFacebookGroups(agency).map((group, index) => (
                            <Button
                                asChild
                                key={`${group.url}-${index}`}
                                variant="outline"
                                className={cn(
                                    "h-auto w-full justify-between rounded-2xl border p-0 text-white shadow-none",
                                    ACTION_CARD_INNER_CLASSNAME,
                                    "hover:bg-white/[0.05] hover:text-white"
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
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ACTION_PILL_CLASSNAME}`}>
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
