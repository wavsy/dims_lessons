"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "@/i18n/navigation";
import type { BookCopy } from "./book-3d";
import { BookMark } from "./book-mark";
import { primaryButton, butterButton } from "./fields";

const Book3D = dynamic(() => import("./book-3d"), { ssr: false });

function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function WelcomeHero({
  title,
  kicker,
  lead,
  signIn,
  coverTitle,
  bookCopy,
  continueLabel,
  continueHref,
}: {
  title: string;
  kicker: string;
  lead: string;
  signIn: string;
  coverTitle?: string;
  bookCopy: BookCopy;
  continueLabel?: string;
  continueHref?: string;
}) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<"pending" | "3d" | "css">("pending");

  useEffect(() => {
    // Decided after mount: WebGL and the motion preference are only known in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage(!reduce && canUseWebGL() ? "3d" : "css");
  }, [reduce]);

  return (
    <div className="grid items-center gap-4 lg:grid-cols-[minmax(320px,560px)_minmax(0,1fr)] lg:gap-10">
      {stage === "3d" ? (
        <Book3D copy={bookCopy} />
      ) : stage === "css" ? (
        <BookMark intro coverTitle={coverTitle ?? title} />
      ) : (
        <div className="book3d" aria-hidden="true" />
      )}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: reduce ? 0 : 0.9 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="kicker">{kicker}</p>
        <h1 className="mt-3 max-w-[12ch] font-display text-[clamp(3.2rem,8vw,5.6rem)] leading-[0.9] font-medium text-balance text-ink">
          {title}
        </h1>
        <p className="mt-4 max-w-md text-[17px] text-soft">{lead}</p>
        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          {continueHref && continueLabel ? (
            <Link className={primaryButton} href={continueHref}>
              {continueLabel}
            </Link>
          ) : null}
          <Link className={continueHref ? butterButton : primaryButton} href="/login">
            {signIn}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
