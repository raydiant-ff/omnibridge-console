import { fetchScrubData } from "./actions";
import { ScrubTable } from "./scrub-table";
import { MonthPicker } from "./month-picker";

export async function ScrubSection({ month }: { month: string }) {
  const data = await fetchScrubData(month);

  return (
    <div className="flex flex-col gap-6">
      <MonthPicker currentMonth={month} />
      <ScrubTable rows={data.rows} summary={data.summary} month={month} />
    </div>
  );
}
