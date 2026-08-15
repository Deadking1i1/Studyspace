import { redirect } from "next/navigation";

export async function GET() {
  redirect("/api/account/export");
}
