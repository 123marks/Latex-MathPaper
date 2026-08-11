import { forwardRef } from "react";
import Icon from "../Icon.jsx";
import { assertOption, classes } from "./_utils.js";

const VARIANTS = ["quiet", "glass", "danger"];
const SIZES = ["compact", "touch"];

const IconButton = forwardRef(function IconButton(
  {
    className,
    disabled = false,
    icon,
    label,
    size = "compact",
    type = "button",
    variant = "quiet",
    ...props
  },
  ref,
) {
  if (typeof label !== "string" || !label.trim()) {
    throw new Error("IconButton requires an accessible label");
  }
  if (typeof icon !== "string" || !icon) {
    throw new Error("IconButton requires an Icon registry name");
  }
  assertOption("IconButton variant", variant, VARIANTS);
  assertOption("IconButton size", size, SIZES);

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classes(
        "icon-btn",
        `icon-btn--${variant}`,
        size === "touch" && "icon-btn--touch",
        className,
      )}
      aria-label={label}
      disabled={disabled}
    >
      <Icon name={icon} size={size === "touch" ? 18 : 16} />
    </button>
  );
});

export default IconButton;
