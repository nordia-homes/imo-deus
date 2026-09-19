"use client";

import { Laptop } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DESKTOP_DOWNLOAD_URL = "https://studio-652232171-42fb6.web.app";

export function DesktopAppCard() {
  return (
    <Card className="agentfinder-settings-card shadow-2xl rounded-2xl bg-[var(--app-surface-solid)] border-none text-white">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Laptop className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-white">Aplicația Desktop</CardTitle>
            <p className="text-sm text-white/70">
              Pentru publicare asistată și automatizări locale avansate.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/65">
          <Laptop className="h-4 w-4" />
          Disponibil pentru Windows · actualizare automată activă.
        </div>
        <Button
          type="button"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => window.open(DESKTOP_DOWNLOAD_URL, "_blank", "noopener,noreferrer")}
        >
          Instalează aplicația desktop
        </Button>
      </CardContent>
    </Card>
  );
}
