import { Prisma } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { prisma } from '../prisma';

export const findEventById = async (eventId: string) => {
  return await prisma.event.findUnique({
    where: { id: eventId },
  });
};

export const approveEvent = async (eventId: string) => {
  return await prisma.event.update({
    where: { id: eventId },
    data: { approved: true },
  });
};

export const saveEvent = async (eventData: Prisma.EventCreateInput) => {
  return prisma.event.create({ data: eventData });
};

export const updateEvent = async (
  id: string,
  data: Prisma.EventUpdateInput,
) => {
  return prisma.event.update({
    where: { id },
    data,
  });
};

export const findEventsForDay = async (startDate: Date, endDate: Date) => {
  return prisma.event.findMany({
    where: {
      AND: [
        {
          date: {
            lte: endOfDay(endDate),
          },
        },
        {
          endDate: {
            gte: startOfDay(startDate),
          },
        },
        {
          approved: true,
        },
      ],
    },
    orderBy: {
      date: 'asc',
    },
  });
};
