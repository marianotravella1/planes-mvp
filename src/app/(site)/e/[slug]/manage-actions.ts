"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db, dbErrorMessage } from "@/lib/db";
import { readEventForm, type EventFormState } from "@/lib/event-form";

// Acciones de quien organiza. La base vuelve a verificar que la cuenta sea la del plan.

export type ManageState = { error?: string };

const NOT_HOST = "Solo quien organiza el plan puede hacer esto.";

export async function removeMember(slug: string, participantId: string, _prev: ManageState): Promise<ManageState> {
  const user = await getSessionUser();
  if (!user) return { error: NOT_HOST };
  try {
    await db()`select app.remove_member(${slug}, ${user.id}, ${participantId})`;
  } catch (error) {
    const message = dbErrorMessage(error);
    if (message === "not_host") return { error: NOT_HOST };
    console.error("removeMember", error);
    return { error: "No pudimos quitar a esa persona. Probá de nuevo." };
  }
  revalidatePath(`/e/${slug}`);
  return {};
}

export async function deleteEvent(slug: string, _prev: ManageState): Promise<ManageState> {
  const user = await getSessionUser();
  if (!user) return { error: NOT_HOST };
  try {
    await db()`select app.delete_event(${slug}, ${user.id})`;
  } catch (error) {
    if (dbErrorMessage(error) === "not_host") return { error: NOT_HOST };
    console.error("deleteEvent", error);
    return { error: "No pudimos eliminar el plan. Probá de nuevo." };
  }
  revalidatePath("/");
  redirect("/");
}

export async function updateEvent(slug: string, _prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const { values, fieldErrors, data } = readEventForm(formData);
  const user = await getSessionUser();
  if (!user) return { error: "Tu sesión venció. Volvé a entrar con tu usuario y contraseña.", values };
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values };

  try {
    await db()`
      select app.update_event(
        ${slug}, ${user.id}, ${data.title}, ${data.description}, ${data.address}, ${data.placeName},
        ${data.lat}, ${data.lng}, ${data.startsAt}, ${data.capacity}
      )
    `;
  } catch (error) {
    const message = dbErrorMessage(error);
    if (message === "not_host") return { error: NOT_HOST, values };
    if (message === "capacity_below_members")
      return {
        fieldErrors: { capacity: "Ya se sumó más gente que ese número. Quitá a alguien o subí el cupo." },
        values,
      };
    if (message === "event_too_far")
      return { fieldErrors: { date: "Elegí una fecha dentro de los próximos seis meses." }, values };
    console.error("updateEvent", error);
    return { error: "No pudimos guardar los cambios. Probá de nuevo.", values };
  }

  revalidatePath(`/e/${slug}`);
  redirect(`/e/${slug}`);
}
