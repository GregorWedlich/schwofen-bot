import { Event } from '@prisma/client';
import {
  notifyAdminsOfEvent,
  postEventToChannel,
  sendSearchToUser,
} from '../services/eventService';

/**
 * Sends the provided event to the administrators for notification.
 *
 * @param event - The event to be sent to the administrators.
 * @returns A promise that resolves when the event has been successfully sent to the administrators.
 */
export async function sendEventToAdmins(event: Event) {
  return notifyAdminsOfEvent(event);
}

/**
 * Publishes the provided event to the event channel.
 *
 * @param event - The event to be published.
 * @returns A promise that resolves when the event has been successfully published to the event channel.
 */
export async function publishEvent(event: Event) {
  return postEventToChannel(event);
}

/**
 * Sends the search results to the user.
 *
 * @param events - The events to be sent to the user.
 * @param dateText - The date text to be sent to the user.
 * @param chatId - The chat ID of the user to send the results to.
 * @returns A promise that resolves when the search results have been successfully sent to the user.
 */
export async function sendSearchResultsToUser(
  events: Event[],
  dateText: string,
  chatId: string,
) {
  return sendSearchToUser(events, dateText, chatId);
}
