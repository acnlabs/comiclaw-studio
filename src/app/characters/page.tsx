import { redirect } from "next/navigation";

/**
 * The index moved to /assets: characters are one kind of asset, and the page
 * has long carried scenes and props too. Shared links and the pre-rename
 * character detail pages still point here.
 */
export default function CharactersIndexRedirect() {
  redirect("/assets");
}
