
import PortalStatusCard from "@/components/portal/PortalStatusCard";

export default function PortalSyncPage() {
    const portals = [
        { name: 'Imobiliare.ro', connected: true, lastSync: 'Acum 5 minute', listings: 42, leads: 12, errors: 0 },
        { name: 'Storia.ro', connected: true, lastSync: 'Acum 10 minute', listings: 38, leads: 8, errors: 1 },
        { name: 'Olx.ro', connected: false, lastSync: '-', listings: 0, leads: 0, errors: 0 },
    ];
  return (
    <div className="space-y-6">
       <div>
            <h1 className="text-3xl font-headline font-bold">Integrări Portale</h1>
            <p className="text-muted-foreground">
                Sincronizează anunțurile și lead-urile cu principalele portaluri imobiliare.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portals.map(portal => (
                <PortalStatusCard key={portal.name} {...portal} />
            ))}
        </div>
    </div>
  );
}
