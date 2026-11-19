import type { Metadata } from "next";
import { AccountsView } from "../_components/accounts-view";

export const metadata: Metadata = { title: "Accounts" };

export default function Page() {
  return <AccountsView />;
}
