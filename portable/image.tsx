import type { ImgHTMLAttributes } from "react";
import mark from "../public/sofia-mark.svg?raw";

const logo = `data:image/svg+xml,${encodeURIComponent(mark)}`;

export default function Image({ src, ...props }: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) {
  delete props.unoptimized;
  // The file bundle embeds its only image directly.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={src === "/sofia-mark.svg" ? logo : src} alt={props.alt ?? ""} />;
}
