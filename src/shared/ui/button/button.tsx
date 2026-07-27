import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "../icon/icon";

export function Button({
  children,
  variant = "primary",
  size = "medium",
  icon,
  trailingIcon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "small" | "medium" | "large";
  icon?: IconName;
  trailingIcon?: IconName;
}) {
  return (
    <button
      className={`button button-${variant} button-${size} ${className}`.trim()}
      {...props}
    >
      {icon && <Icon name={icon} size={17} />}
      <span>{children}</span>
      {trailingIcon && <Icon name={trailingIcon} size={17} />}
    </button>
  );
}
