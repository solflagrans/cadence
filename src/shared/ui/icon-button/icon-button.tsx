import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "../icon/icon";

export function IconButton({
  icon,
  label,
  className = "",
  size = "medium",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  label: string;
  size?: "small" | "medium" | "large";
}) {
  return (
    <button
      className={`icon-button icon-button-${size} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name={icon} size={size === "small" ? 16 : 18} />
    </button>
  );
}
