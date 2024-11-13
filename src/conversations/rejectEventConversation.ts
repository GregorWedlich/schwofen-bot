import { Conversation } from "@grammyjs/conversations";
import { MyContext } from "../types/context";
import { prisma } from "../prisma";

export async function rejectEventConversation(
  conversation: Conversation<MyContext>,
  ctx: MyContext
) {
  const eventId = ctx.session.eventId;

  if (!eventId) {
    await ctx.reply(
      "Es ist ein Fehler aufgetreten. Keine Veranstaltungs-ID gefunden."
    );
    return;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    await ctx.reply("Veranstaltung nicht gefunden.");
    return;
  }

  await ctx.reply("Bitte gib den Grund für die Ablehnung ein:");

  const reasonResponse = await conversation.waitFor("message:text");
  const rejectionReason = reasonResponse.message.text;

  await prisma.event.update({
    where: { id: eventId },
    data: {
      approved: false,
      rejectionReason: rejectionReason,
    },
  });

  try {
    await ctx.api.sendMessage(
      event.submittedById,
      `Deine Veranstaltung "${event.title}" wurde abgelehnt.\nGrund: ${rejectionReason}`
    );
  } catch (error) {
    console.error("Fehler beim Senden der Nachricht an den Nutzer:", error);
  }

  await ctx.reply(
    "Veranstaltung wurde abgelehnt und der Grund wurde dem Nutzer mitgeteilt."
  );

  delete ctx.session.eventId;
}
