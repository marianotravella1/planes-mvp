import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { endSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await endSession();
  revalidatePath("/", "layout");
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
