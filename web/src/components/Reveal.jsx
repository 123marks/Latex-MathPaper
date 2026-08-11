import { motion } from "framer-motion";
import { useReducedMotion } from "../lib/motion.js";

const EASE = [0.16, 1, 0.3, 1];

export default function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  once = true,
}) {
  const reduced = useReducedMotion();
  const motionProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once, margin: "-80px" },
        transition: { duration: 0.7, ease: EASE, delay },
      };

  return (
    <motion.div
      className={className}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
