import { forwardRef } from "react";
import { assertOption, classes } from "./_utils.js";

const VARIANTS = ["primary", "glass", "quiet", "danger", "ghostAmber"];
const SIZES = ["sm", "md", "lg"];

const Button = forwardRef(function Button(
  {
    block = false,
    children,
    className,
    disabled = false,
    loading = false,
    size = "md",
    type = "button",
    variant = "primary",
    ...props
  },
  ref,
) {
  assertOption("Button variant", variant, VARIANTS);
  assertOption("Button size", size, SIZES);
  const variantClass = variant === "ghostAmber" ? "btn-ghost-amber" : `btn-${variant}`;

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={classes(
        "btn",
        variantClass,
        size !== "md" && `btn-${size}`,
        block && "btn-block",
        loading && "is-running",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-state={loading ? "loading" : undefined}
    >
      {children}
    </button>
  );
});

export default Button;
