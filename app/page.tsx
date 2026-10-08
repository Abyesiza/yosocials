import Image from "next/image";
import CalendarMonth from "@mui/icons-material/CalendarMonth";
import Insights from "@mui/icons-material/Insights";
import ManageAccounts from "@mui/icons-material/ManageAccounts";
import TrendingUp from "@mui/icons-material/TrendingUp";
import ContentCalendar from "./components/ContentCalendar";
import { platforms } from "./lib/platforms";

const features = [
  {
    Icon: CalendarMonth,
    title: "Smart Content & Calendar",
    description:
      "Upload raw videos, images, or drafts and the agent builds a ready-to-post calendar, tailored to each channel and timed to when your audience is active.",
    badge: "bg-blue-600",
  },
  {
    Icon: TrendingUp,
    title: "Real-Time Trend Spotting",
    description:
      "Scans trending audio, topics, and formats on Instagram and X, then matches them to your niche with ready-to-approve draft posts.",
    badge: "bg-amber-600",
  },
  {
    Icon: Insights,
    title: "Unified Analytics",
    description:
      "One view of audience demographics, engagement sentiment, and growth across every connected account.",
    badge: "bg-emerald-600",
  },
  {
    Icon: ManageAccounts,
    title: "Multi-Account Management",
    description:
      "Separate personas and rules for individual, influencer, and company accounts, with built-in ad boost automation.",
    badge: "bg-rose-600",
  },
];

const sectionPadding = "px-6 sm:px-10 lg:px-16 xl:px-24";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <main className="flex flex-1 flex-col">
        <section
          className={`flex flex-col items-center gap-6 ${sectionPadding} py-20 text-center sm:py-28`}
        >
          <Image
            src="/logo.png"
            alt="Yo Socials logo"
            width={500}
            height={500}
            priority
            className="h-24 w-24 rounded-2xl sm:h-28 sm:w-28"
          />
          <h1 className="text-4xl font-bold tracking-tight text-black sm:text-5xl">
            Yo Socials
          </h1>
          <p className="max-w-md text-lg font-medium leading-8 text-zinc-700">
            The autonomous AI agent that drafts, schedules, and grows your
            presence across every platform.
          </p>
          <div className="flex items-center gap-5 pt-2">
            {Object.values(platforms).map(({ Icon, label, color }) => (
              <Icon key={label} title={label} color={color} className="h-6 w-6" />
            ))}
          </div>
        </section>

        <section id="features" className={`w-full ${sectionPadding} pb-20 sm:pb-28`}>
          <h2 className="text-center text-2xl font-bold tracking-tight text-black sm:text-3xl">
            Features
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ Icon, title, description, badge }) => (
              <div
                key={title}
                className="rounded-2xl border border-zinc-200 bg-white p-6"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${badge}`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-black">
                  {title}
                </h3>
                <p className="mt-2 text-base font-medium leading-7 text-zinc-700">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <ContentCalendar />
      </main>
    </div>
  );
}
