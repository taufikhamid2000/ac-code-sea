import Link from "next/link";
import { AppLogoMark } from "@/components/AppLogoMark";

/** Split-screen branding panel used by the standalone /login page. */
export function AuthBrandingPanel() {
  return (
    <div className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-neutral-900 px-10 py-12 text-white md:flex lg:w-[38%]">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-yellow-500/10" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-yellow-500/10" />

      <Link href="/" className="relative flex items-center gap-2.5">
        <AppLogoMark size={22} className="text-yellow-500/90" />
        <span className="text-xs font-medium uppercase tracking-[6px] text-white/70">
          AC · Code SEA
        </span>
      </Link>

      <div className="relative">
        <p className="font-serif text-2xl leading-snug text-balance">
          Siege of Malacca
        </p>
        <p className="mt-3 max-w-sm text-sm text-white/60">
          The Brotherhood, in pre-colonial Southeast Asia. A browser-playable
          2D side-scroller — sign in to save progress, build levels, and
          share them with the community.
        </p>
      </div>

      <p className="relative text-xs text-white/40">
        A project by{" "}
        <a
          href="https://taufik.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-white/60 hover:underline"
        >
          Muhammad Taufik &rarr;
        </a>
      </p>
    </div>
  );
}
