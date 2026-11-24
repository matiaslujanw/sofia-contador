import type { AnchorHTMLAttributes } from "react";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export default function Link({ href, ...props }: LinkProps) {
  return <a {...props} href={href.startsWith("/") ? `#${href}` : href} />;
}

const router = {
  push(path: string) { window.location.hash = path; },
  replace(path: string) {
    window.history.replaceState(null, "", `#${path}`);
    window.dispatchEvent(new Event("hashchange"));
  },
  refresh() { window.dispatchEvent(new Event("hashchange")); },
};

export function useRouter() {
  return router;
}
