import { redirect } from "next/navigation";
import { DISCOVER_COLUMN_CAT } from "@/lib/discover";

export default function ColumnsIndexRedirect() {
  redirect(`/series?cat=${encodeURIComponent(DISCOVER_COLUMN_CAT)}`);
}
