import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Refined toaster — top-center, accent-aware, spring entrance.
 * Uses Sonner's built-in offset/animations (no fixed-center positioning hack),
 * so toasts slide in from the top, stack cleanly, and swipe-to-dismiss works.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <>
      <style>{`
        [data-sonner-toaster] {
          font-family: 'Poppins', system-ui, -apple-system, sans-serif;
        }
        [data-sonner-toaster] [data-sonner-toast] {
          transition: transform 320ms cubic-bezier(.22,1.36,.36,1), opacity 220ms ease !important;
        }
        [data-sonner-toaster] [data-sonner-toast][data-mounted="true"][data-y-position="top"] {
          animation: lov-toast-in 380ms cubic-bezier(.22,1.36,.36,1) both;
        }
        @keyframes lov-toast-in {
          from { transform: translate3d(0,-22px,0) scale(.92); opacity: 0; }
          to   { transform: translate3d(0,0,0)     scale(1);   opacity: 1; }
        }
        [data-sonner-toaster] [data-sonner-toast][data-removed="true"] {
          animation: lov-toast-out 220ms ease both !important;
        }
        @keyframes lov-toast-out {
          to { transform: translate3d(0,-14px,0) scale(.96); opacity: 0; }
        }
      `}</style>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        position="top-center"
        richColors={false}
        closeButton={false}
        duration={3800}
        gap={10}
        offset={18}
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              "group inline-flex items-start gap-2.5 !rounded-2xl !border !border-white/10 !bg-black/85 !text-white !backdrop-blur-2xl !shadow-[0_18px_48px_-12px_rgba(0,0,0,.55),0_2px_6px_rgba(0,0,0,.25)] !px-4 !py-3 !min-h-0 !w-auto !max-w-[92vw] mx-auto",
            title: "!text-[13px] !font-medium !leading-tight",
            description: "!text-[12px] !text-white/70 !leading-snug !mt-0.5",
            icon: "!m-0 !mt-0.5 [&_svg]:!h-4 [&_svg]:!w-4",
            actionButton:
              "!rounded-full !bg-white !text-black !text-[11.5px] !font-medium !px-3 !py-1 !ml-2 hover:!bg-white/90",
            cancelButton:
              "!rounded-full !bg-white/10 !text-white !text-[11.5px] !px-3 !py-1 hover:!bg-white/20",
            success: "[&_[data-icon]_svg]:!text-emerald-400 !border-l-2 !border-l-emerald-400/70",
            error:   "[&_[data-icon]_svg]:!text-rose-400   !border-l-2 !border-l-rose-400/70",
            warning: "[&_[data-icon]_svg]:!text-amber-400  !border-l-2 !border-l-amber-400/70",
            info:    "[&_[data-icon]_svg]:!text-sky-400    !border-l-2 !border-l-sky-400/70",
          },
        }}
        {...props}
      />
    </>
  );
};

export { Toaster, toast };
