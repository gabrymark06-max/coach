import { redirect } from "next/navigation";

/** `/` porta alla home a feed (§6.1): in v1 portava a `/allenamento`. */
export default function Index() {
  redirect("/home");
}
