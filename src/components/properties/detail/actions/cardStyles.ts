export const ACTION_CARD_CLASSNAME =
  "overflow-hidden rounded-[1.7rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,31,49,0.98)_0%,rgba(14,24,39,0.98)_100%)] text-white shadow-[0_24px_64px_-36px_rgba(0,0,0,0.82)] backdrop-blur-xl";

export const ACTION_CARD_INTERACTIVE_CLASSNAME =
  `${ACTION_CARD_CLASSNAME} transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-sky-300/16 hover:shadow-[0_28px_72px_-34px_rgba(0,0,0,0.88)]`;

export const ACTION_CARD_INNER_CLASSNAME =
  "border border-white/8 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export const ACTION_PILL_CLASSNAME =
  "border border-sky-200/16 bg-white/[0.045] text-white hover:bg-white/[0.09]";

export const ACTION_INPUT_CLASSNAME =
  "border-white/12 bg-[#162538] text-white placeholder:text-white/42 focus-visible:ring-1 focus-visible:ring-white/12";

export const ACTION_ICON_WRAPPER_CLASSNAME =
  `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[999px] ${ACTION_PILL_CLASSNAME}`;

export const ACTION_ICON_CLASSNAME = "h-4 w-4 text-sky-100";
