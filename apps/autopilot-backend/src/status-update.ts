import type { z } from "zod";

import type {
  StatusUpdateSchema,
  WSServerMessageSchema,
} from "./message-schema";

// Status management types and utilities
type StatusUpdate = z.infer<typeof StatusUpdateSchema>;
type StatusType = StatusUpdate["type"];

let idCounter = 0;
function generateStatusId(): string {
  return `status_${++idCounter}_${Date.now()}`;
}

export class Status {
  private _status: StatusUpdate;
  private sendMessage: (data: z.infer<typeof WSServerMessageSchema>) => void;
  private userId: string;

  constructor(
    message: string,
    options: { type: StatusType; description?: string },
    sendMessage: (data: z.infer<typeof WSServerMessageSchema>) => void,
    userId: string,
  ) {
    this._status = {
      id: generateStatusId(),
      message,
      type: options.type,
      description: options.description,
      timestamp: Date.now(),
    };
    this.sendMessage = sendMessage;
    this.userId = userId;

    // Add to user statuses and send initial update
    addUserStatus(this.userId, this._status);
    this.sendMessage({
      type: "statusUpdate",
      status: this._status,
    });
  }

  update(
    message: string,
    options?: { type?: StatusType; description?: string },
  ) {
    this._status = {
      ...this._status,
      message,
      type: options?.type ?? this._status.type,
      description: options?.description ?? this._status.description,
      timestamp: Date.now(),
    };

    // Update in user statuses and send update
    updateUserStatus(this.userId, this._status);
    this.sendMessage({
      type: "statusUpdate",
      status: this._status,
    });
  }

  get id() {
    return this._status.id;
  }

  get data() {
    return { ...this._status };
  }
}

// User status storage
const userStatuses: Record<string, Record<string, StatusUpdate>> = {};

function addUserStatus(userId: string, status: StatusUpdate) {
  userStatuses[userId] ??= {};
  userStatuses[userId][status.id] = status;
}

function updateUserStatus(userId: string, status: StatusUpdate) {
  userStatuses[userId] ??= {};
  userStatuses[userId][status.id] = status;
}

function getUserStatuses(userId: string): StatusUpdate[] {
  if (!userStatuses[userId]) {
    return [];
  }
  return Object.values(userStatuses[userId]).sort(
    (a, b) => a.timestamp - b.timestamp,
  );
}

function clearUserStatuses(userId: string) {
  if (userStatuses[userId]) {
    userStatuses[userId] = {};
  }
}

export function createStatus(
  userId: string,
  message: string,
  options: { type: StatusType; description?: string },
  sendMessage: (data: z.infer<typeof WSServerMessageSchema>) => void,
): Status {
  return new Status(message, options, sendMessage, userId);
}
