import createDraft from "./tools/createDraft.ts";
import getCurrentDraft from "./tools/getCurrentDraft.ts";
import getCurrentMessage from "./tools/getCurrentMessage.ts";
import getInboxMessages from "./tools/getInboxMessages.ts";
import searchMessages from "./tools/searchMessages.ts";
import selectMessage from "./tools/selectMessage.ts";
import sendCurrentDraft from "./tools/sendCurrentDraft.ts";
import updateDraft from "./tools/updateDraft.ts";

export default {
  getInboxMessages,
  searchMessages,
  selectMessage,
  getCurrentMessage,
  createDraft,
  updateDraft,
  getCurrentDraft,
  sendCurrentDraft,
};
