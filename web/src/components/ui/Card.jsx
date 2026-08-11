import { forwardRef } from "react";
import { assertOption, classes } from "./_utils.js";

const VARIANTS = ["default", "app"];

const Card = forwardRef(function Card(
  { as: Component = "div", className, lift = false, variant = "default", ...props },
  ref,
) {
  assertOption("Card variant", variant, VARIANTS);
  return (
    <Component
      {...props}
      ref={ref}
      className={classes("card", variant !== "default" && variant, lift && "lift", className)}
    />
  );
});

export default Card;
