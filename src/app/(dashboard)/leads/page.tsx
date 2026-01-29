
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
import { LeadList } from "@/components/leads/LeadList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-headline font-bold">Lead-uri</h1>
            <p className="text-muted-foreground">
                Gestionează potențialii clienți.
            </p>
        </div>
        <AddLeadDialog />
      </div>

      <div className="flex items-center gap-4">
        <Input placeholder="Filtrează după nume..." className="max-w-xs" />
        <Select>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="nou">Nou</SelectItem>
                <SelectItem value="contactat">Contactat</SelectItem>
                <SelectItem value="in-negociere">În negociere</SelectItem>
            </SelectContent>
        </Select>
         <Select>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sursă" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="recomandare">Recomandare</SelectItem>
                <SelectItem value="portal">Portal</SelectItem>
            </SelectContent>
        </Select>
      </div>

      <LeadList />
    </div>
  )
}
