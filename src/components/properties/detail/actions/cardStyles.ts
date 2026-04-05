export const ACTION_CARD_CLASSNAME =
  "overflow-hidden rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(88,214,141,0.12),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.1),transparent_36%),linear-gradient(180deg,#122033_0%,#0d1726_58%,#09111c_100%)] text-white shadow-[0_30px_90px_-42px_rgba(0,0,0,0.9)] backdrop-blur-sm";

export const ACTION_CARD_INTERACTIVE_CLASSNAME =
  `${ACTION_CARD_CLASSNAME} transition-[transform,box-shadow,border-color,background] duration-300 hover:-translate-y-0.5 hover:border-emerald-300/18 hover:shadow-[0_34px_100px_-40px_rgba(0,0,0,0.95)]`;

export const ACTION_CARD_INNER_CLASSNAME =
  "border border-white/8 bg-white/[0.035]";

export const ACTION_PILL_CLASSNAME =
  "border border-emerald-300/18 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/14";

export const ACTION_INPUT_CLASSNAME =
  "border-white/12 bg-[#0c1521] text-white placeholder:text-white/35";

export const ACTION_ICON_WRAPPER_CLASSNAME =
  `inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[999px] ${ACTION_PILL_CLASSNAME}`;

export const ACTION_ICON_CLASSNAME = "h-4 w-4 text-emerald-200";
