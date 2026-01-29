import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyList } from "@/components/properties/PropertyList";

export default function PropertiesPage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-headline font-bold">Proprietăți</h1>
                <p className="text-muted-foreground">
                    Gestionează portofoliul tău de proprietăți.
                </p>
            </div>
            <AddPropertyDialog />
        </div>
        <PropertyList />
    </div>
  );
}
