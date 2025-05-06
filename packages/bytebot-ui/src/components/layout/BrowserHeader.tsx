export const BrowserHeader: React.FC = () => {
  return (
    <header className="shadow-bytebot bg-[#F6F4F4] flex w-full gap-2 overflow-hidden px-4 py-2.5 rounded-[12px_12px_0px_0px] border-[0.5px] border-solid border-[rgba(0,0,0,0.16)] max-md:max-w-full">
      <div className="flex min-w-60 h-10 w-full items-center gap-2.5 flex-wrap flex-1 shrink basis-[0%] max-md:max-w-full">
        <div className="self-stretch flex min-w-60 flex-col items-stretch text-xs justify-center flex-1 shrink basis-4 max-md:max-w-full">
        </div>

        <button className="bg-[rgba(255,241,254,1)] shadow-[0px_1px_1px_rgba(0,0,0,0.06)] self-stretch flex items-center gap-1 text-[11px] text-[rgba(184,62,171,1)] font-medium leading-none justify-center my-auto px-2 py-1.5 rounded-lg">
          <div className="bg-[rgba(255,213,252,1)] self-stretch flex w-4 shrink-0 h-4 gap-2 my-auto rounded-[100px]" />
          <span>Take Over</span>
        </button>
      </div>
    </header>
  );
};
