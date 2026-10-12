import archiveMessage from "./tools/archiveMessage.ts";
import createDraft from "./tools/createDraft.ts";
import deleteMessage from "./tools/deleteMessage.ts";
import getCurrentDraft from "./tools/getCurrentDraft.ts";
import getCurrentMessage from "./tools/getCurrentMessage.ts";
import getMessages from "./tools/getMessages.ts";
import moveMessage from "./tools/moveMessage.ts";
import searchMessages from "./tools/searchMessages.ts";
import selectMessage from "./tools/selectMessage.ts";
import sendCurrentDraft from "./tools/sendCurrentDraft.ts";
import updateDraft from "./tools/updateDraft.ts";
import updateMessageFlags from "./tools/updateMessageFlags.ts";

export default [
  getMessages,
  searchMessages,
  selectMessage,
  getCurrentMessage,
  createDraft,
  updateDraft,
  getCurrentDraft,
  sendCurrentDraft,
  updateMessageFlags,
  archiveMessage,
  moveMessage,
  deleteMessage,
];
