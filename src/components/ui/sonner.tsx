import { Toaster as Sonner } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Dark glass toasts with soft semantic borders. */
const Toaster = ({ richColors: _rc, ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      theme="dark"
      duration={4500}
      icons={{
        success: <CheckCircle2 className="size-4 text-primary" />,
        error: <XCircle className="size-4 text-destructive" />,
        warning: <AlertTriangle className="size-4 text-amber-400" />,
        info: <Info className="size-4 text-muted-foreground" />,
        loading: <Loader2 className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast !rounded-2xl !border !border-border/60 !bg-background/80 !text-foreground !backdrop-blur-md !shadow-2xl !font-bold !text-[13px] !leading-relaxed",
          error: "!border-destructive/45 !bg-destructive/10",
          success: "!border-primary/40",
          warning: "!border-amber-500/45 !bg-amber-500/10",
          description: "!text-muted-foreground !font-normal",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-muted !text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
