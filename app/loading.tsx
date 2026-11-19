import LogoSpinner from "./components/LogoSpinner";

export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background py-32">
      <LogoSpinner size={72} label="Loading Yo Socials" />
    </div>
  );
}
