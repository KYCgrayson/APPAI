import type { ReactElement } from "react";
import { Icon, ICON_NAMES } from "@/components/ui/Icon";

export interface SmartIconProps {
  value?: string | null;
  className?: string;
  size?: number | string;
}

const IMAGE_URL_RE = /^https:\/\/.+\.(svg|png|jpg|jpeg|webp|gif|avif)(\?.*)?$/i;
const ICON_NAME_RE = /^[a-z][a-z0-9-]*$/;

export function SmartIcon({
  value,
  className,
  size = 20,
}: SmartIconProps): ReactElement | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (IMAGE_URL_RE.test(value)) {
    return (
      <img
        src={value}
        alt=""
        loading="lazy"
        className={className}
        style={{ width: size, height: size }}
      />
    );
  }

  if (ICON_NAME_RE.test(value) && ICON_NAMES.includes(value)) {
    return <Icon name={value} size={size} className={className} />;
  }

  return (
    <span className={className} style={{ fontSize: size }}>
      {value}
    </span>
  );
}
