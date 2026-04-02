import createDraft from "./tools/createDraft.ts";
import getCurrentDraft from "./tools/getCurrentDraft.ts";
import getCurrentMessage from "./tools/getCurrentMessage.ts";
import getMessages from "./tools/getMessages.ts";
import searchMessages from "./tools/searchMessages.ts";
import selectMessage from "./tools/selectMessage.ts";
import sendCurrentDraft from "./tools/sendCurrentDraft.ts";
import updateDraft from "./tools/updateDraft.ts";

export default {
  getMessages,
  searchMessages,
  selectMessage,
  getCurrentMessage,
  createDraft,
  updateDraft,
  getCurrentDraft,
  sendCurrentDraft,
};
