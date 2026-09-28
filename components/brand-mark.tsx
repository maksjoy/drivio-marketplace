export function BrandMark() {
  return (
    <span className="inline-flex h-11 items-center gap-2 leading-none" aria-hidden="true">
      <span className="flex min-w-0 flex-col justify-center">
        <span className="mb-0.5 flex items-center gap-1.5">
          <span className="font-serif text-[12px] font-semibold italic tracking-wide text-rig-700 sm:text-[13px]">Alberta</span>
          <WildRoseMark />
        </span>
        <span className="whitespace-nowrap text-[21px] font-black tracking-[-0.045em] text-wildrose-600 sm:text-[23px]">Alberta-Cars</span>
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-rig-700 sm:text-[9px]">Wild Rose Country</span>
      </span>
    </span>
  );
}

function WildRoseMark() {
  return (
    <svg viewBox="0 0 28 28" className="h-4 w-4 shrink-0 text-wildrose-600 sm:h-[17px] sm:w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 13.4c-4.2-4-2.5-8.9 1.2-9.7 1.4 2.4 1.5 4.9.3 7.2 2.2-2.1 4.8-2.5 7.2-.8-.1 4-3.8 6.4-7.5 4.8 2.1 2 2.8 4.6 1.1 7-3.9-.2-6.3-3.5-5-7.1-2 2.2-4.6 3-7 1.4.1-3.7 3-6.2 6.5-5.4-2.4-1.8-3.2-4.4-1.8-7 3.8-.1 6.4 2.6 5.9 6.2" />
      <circle cx="14" cy="13.5" r="2.1" />
      <path d="M14 15.6v8.1M14 20.1c-2.3-1.8-4.2-1.6-5.7-.4M14 21.1c2.2-1.5 4.1-1.2 5.4.1" />
    </svg>
  );
}
