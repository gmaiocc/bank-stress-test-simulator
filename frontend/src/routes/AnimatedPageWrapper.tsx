import { motion, useReducedMotion } from "framer-motion";
import React from "react";

export function AnimatedPageWrapper({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();

  const variants = {
    initial: { opacity: 0, y: 8, scale: 0.998 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.998 },
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={reduce ? { duration: 0 } : { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}