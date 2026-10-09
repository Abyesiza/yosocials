import { platforms, type PlatformKey } from "../lib/platforms";

type CalendarItem = {
  platform: PlatformKey;
  title: string;
  time: string;
  status?: "Pending approval";
};

type CalendarDay = {
  day: string;
  date: string;
  items: CalendarItem[];
};

const week: CalendarDay[] = [
  {
    day: "Mon",
    date: "12",
    items: [{ platform: "instagram", title: "Reel: trending audio", time: "10:00 AM" }],
  },
  {
    day: "Tue",
    date: "13",
    items: [{ platform: "x", title: "Thread: product update", time: "9:00 AM" }],
  },
  {
    day: "Wed",
    date: "14",
    items: [{ platform: "whatsapp", title: "Status: weekly tip", time: "6:00 PM" },
            {platform: "facebook", title: "Facebook update", time:"7:00PM"}
    ],
  },
  {
    day: "Thu",
    date: "15",
    items: [
      {
        platform: "tiktok",
        title: "Duet: creator trend",
        time: "11:00 AM",
        status: "Pending approval",
      },
      {
        platform: "linkedin",
        title: "Just some linkedin",
        time: "2:00AM"
      }
    ],
  },
  {
    day: "Fri",
    date: "16",
    items: [
      { platform: "instagram", title: "Carousel: behind the scenes", time: "2:00 PM" },
      { platform: "x", title: "Poll: audience Q&A", time: "4:00 PM" },
    ],
  },
  {
    day: "Sat",
    date: "17",
    items: [{ platform: "whatsapp", title: "Broadcast: weekend recap", time: "5:00 PM" }],
  },
  {
    day: "Sun",
    date: "18",
    items: [{ platform: "tiktok", title: "Trend remix", time: "12:00 PM" }],
  },
];

export default function ContentCalendar() {
  return (
    <section className="w-full px-6 pb-20 sm:px-10 sm:pb-28 lg:px-16 xl:px-24">
      <h2 className="text-center text-2xl font-bold tracking-tight text-black sm:text-3xl">
        Content Calendar
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-base font-medium leading-7 text-zinc-700">
        A preview of a typical week once Yo Socials takes over your
        scheduling.
      </p>

      <div className="mt-10 overflow-x-auto">
        <div className="grid grid-flow-col auto-cols-[minmax(150px,1fr)] gap-4 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-7">
          {week.map(({ day, date, items }) => (
            <div
              key={day}
              className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <div className="text-sm font-bold text-black">
                {day} <span className="text-zinc-500">{date}</span>
              </div>
              {items.map(({ platform, title, time, status }) => {
                const { Icon, label, color } = platforms[platform];
                return (
                  <div key={title} className="rounded-xl bg-zinc-50 p-3">
                    <Icon title={label} color={color} className="h-4 w-4" />
                    <p className="mt-2 text-sm font-semibold leading-5 text-black">
                      {title}
                    </p>
                    <p className="mt-1 text-xs font-medium text-zinc-600">{time}</p>
                    {status && (
                      <p className="mt-1 text-xs font-bold text-amber-600">
                        {status}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
