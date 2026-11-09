import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Box, ImageOff, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  useUpdateArticleIllustration,
  type Article,
} from "@/lib/data/queries";
import { ModelWizard } from "./ModelWizard";

interface Props {
  article: Article;
  open: boolean;
  onClose: () => void;
}

/**
 * Small choice modal shown when Admin clicks the "No 3D Model" badge
 * on a pending article, from Inventory or the Designer palette.
 *
 * Two paths:
 *  - No Illustration  → article available in orders/BOM as a 2D placeholder.
 *  - Make 3D Model    → opens the wizard (Phase 2 — placeholder for now).
 */
export function ModelActionModal({ article, open, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const updateIllustration = useUpdateArticleIllustration();

  const chooseNoIllustration = async () => {
    setBusy(true);
    try {
      await updateIllustration.mutateAsync({
        id: article.id,
        status: "no_illustration",
      });
      toast.success(`${article.code} marked as 2D only`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openWizard = () => {
    setWizardOpen(true);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            3D Illustration
            <Badge variant="outline" className="font-mono text-[10px]">
              {article.code}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {article.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <button
            type="button"
            disabled={busy}
            onClick={chooseNoIllustration}
            className="text-left rounded-lg border border-border bg-card hover:border-accent hover:shadow-[var(--shadow-soft)] p-4 transition disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-muted p-2">
                <ImageOff className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium">No Illustration</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Skip 3D. Article stays orderable in Quick Orders and BOM, and
                  appears as a flat 2D placeholder in the Designer.
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={openWizard}
            className="text-left rounded-lg border border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10 p-4 transition disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-primary/15 p-2">
                <Box className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium flex items-center gap-1.5">
                  Make 3D Model
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Walk through the guided wizard to procedurally build a Three.js
                  model that blends with the existing units.
                </p>
              </div>
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {wizardOpen && (
      <ModelWizard
        article={article}
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          onClose();
        }}
      />
    )}
    </>
  );
}